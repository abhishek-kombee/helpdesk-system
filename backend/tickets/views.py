"""API views for the helpdesk application."""
import logging
from django.contrib.auth import authenticate
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from .models import User, Ticket, Comment
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    TicketSerializer, TicketDetailSerializer, CommentSerializer,
)
from .metrics import tickets_created_total
from .anomalies import inject_artificial_delay, inject_random_error, inject_slow_query
from .tracing import get_tracer

logger = logging.getLogger('tickets')


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """Register a new user."""
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        logger.warning("Validation error on registration", extra={
            'event': 'validation_error',
            'errors': serializer.errors,
        })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    refresh = RefreshToken.for_user(user)

    return Response({
        'user': UserSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Login with email and password."""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    password = serializer.validated_data['password']

    # Find user by email
    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        logger.warning("Login failed - user not found", extra={
            'event': 'login_failed',
            'email': email,
        })
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    user = authenticate(username=user_obj.username, password=password)
    if user is None:
        logger.warning("Login failed - wrong password", extra={
            'event': 'login_failed',
            'email': email,
        })
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'user': UserSerializer(user).data,
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    })


@api_view(['GET'])
def me_view(request):
    """Get current user info."""
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
def users_list_view(request):
    """List all agents for assignment dropdown."""
    agents = User.objects.filter(role='agent')
    return Response(UserSerializer(agents, many=True).data)


class TicketViewSet(viewsets.ModelViewSet):
    """CRUD for tickets with filtering and pagination."""
    queryset = Ticket.objects.select_related('created_by', 'assigned_to').all()
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to']
    ordering_fields = ['created_at', 'updated_at', 'priority']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TicketDetailSerializer
        return TicketSerializer

    def list(self, request, *args, **kwargs):
        # Anomaly injection
        error_response = inject_random_error(request)
        if error_response:
            return error_response

        inject_artificial_delay()
        inject_slow_query()

        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        tracer = get_tracer()
        with tracer.start_as_current_span("validate_ticket_input") as span:
            span.set_attribute("user_id", request.user.id)
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                span.set_attribute("validation.valid", False)
                logger.warning("Ticket validation error", extra={
                    'event': 'validation_error',
                    'errors': serializer.errors,
                    'user_id': request.user.id,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            span.set_attribute("validation.valid", True)

        ticket = serializer.save(created_by=request.user)
        tickets_created_total.inc()

        logger.info("Ticket created", extra={
            'event': 'ticket_created',
            'ticket_id': ticket.id,
            'user_id': request.user.id,
        })

        return Response(
            TicketSerializer(ticket).data,
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        tracer = get_tracer()
        instance = self.get_object()

        with tracer.start_as_current_span("assign_ticket_logic") as span:
            span.set_attribute("user_id", request.user.id)
            span.set_attribute("ticket_id", instance.id)

            serializer = self.get_serializer(instance, data=request.data, partial=True)
            if not serializer.is_valid():
                logger.warning("Ticket update validation error", extra={
                    'event': 'validation_error',
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            assigned_to_id = serializer.validated_data.get('assigned_to_id')
            if assigned_to_id is not None:
                span.set_attribute("assigned_to_id", assigned_to_id)

            ticket = serializer.save()

        return Response(TicketSerializer(ticket).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        tracer = get_tracer()
        instance = self.get_object()

        with tracer.start_as_current_span("fetch_comments") as span:
            span.set_attribute("ticket_id", instance.id)
            span.set_attribute("user_id", request.user.id)
            comment_count = instance.comments.count()
            span.set_attribute("comment_count", comment_count)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CommentViewSet(viewsets.ModelViewSet):
    """CRUD for comments nested under tickets."""
    serializer_class = CommentSerializer

    def get_queryset(self):
        return Comment.objects.filter(
            ticket_id=self.kwargs['ticket_pk']
        ).select_related('user')

    def create(self, request, *args, **kwargs):
        ticket_id = self.kwargs['ticket_pk']
        # Verify ticket exists
        try:
            ticket = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            return Response(
                {'error': 'Ticket not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.warning("Comment validation error", extra={
                'event': 'validation_error',
                'errors': serializer.errors,
            })
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        comment = serializer.save(user=request.user, ticket=ticket)
        return Response(
            CommentSerializer(comment).data,
            status=status.HTTP_201_CREATED
        )
