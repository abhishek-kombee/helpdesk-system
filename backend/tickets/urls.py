from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'tickets', views.TicketViewSet, basename='ticket')

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.me_view, name='me'),
    path('users/', views.users_list_view, name='users-list'),
    path('tickets/<int:ticket_pk>/comments/',
         views.CommentViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='ticket-comments'),
    path('tickets/<int:ticket_pk>/comments/<int:pk>/',
         views.CommentViewSet.as_view({
             'get': 'retrieve',
             'put': 'update',
             'patch': 'partial_update',
             'delete': 'destroy',
         }),
         name='ticket-comment-detail'),
] + router.urls
