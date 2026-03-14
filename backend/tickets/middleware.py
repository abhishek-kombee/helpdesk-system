"""Django middleware for metrics and structured logging."""
import time
import logging
import uuid

from opentelemetry import trace
from .metrics import http_requests_total, http_request_duration_seconds, active_users_total

logger = logging.getLogger('tickets')

# Track active users (simple in-memory set with timestamps)
_active_users = {}


class MetricsMiddleware:
    """Records Prometheus HTTP metrics for every request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request._start_time = time.time()
        response = self.get_response(request)
        duration = time.time() - request._start_time

        # Normalize endpoint path
        endpoint = self._normalize_path(request.path)
        method = request.method

        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status_code=response.status_code
        ).inc()

        http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)

        # Track active users
        if hasattr(request, 'user') and request.user.is_authenticated:
            _active_users[request.user.id] = time.time()
            # Clean up users inactive for > 5 minutes
            cutoff = time.time() - 300
            active = {uid: ts for uid, ts in _active_users.items() if ts > cutoff}
            _active_users.clear()
            _active_users.update(active)
            active_users_total.set(len(_active_users))

        return response

    def _normalize_path(self, path):
        """Normalize URL path to reduce cardinality."""
        parts = path.strip('/').split('/')
        normalized = []
        for part in parts:
            if part.isdigit():
                normalized.append('{id}')
            else:
                normalized.append(part)
        return '/' + '/'.join(normalized) + '/' if normalized else '/'


class RequestLoggingMiddleware:
    """Structured JSON logging for every request with trace correlation."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request._start_time = time.time()
        request._request_id = str(uuid.uuid4())

        response = self.get_response(request)

        duration_ms = round((time.time() - request._start_time) * 1000, 2)

        # Get trace context
        span = trace.get_current_span()
        span_context = span.get_span_context()
        trace_id = format(span_context.trace_id, '032x') if span_context.trace_id else ''
        span_id = format(span_context.span_id, '016x') if span_context.span_id else ''

        user_id = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id

        log_data = {
            'event': 'http_request',
            'method': request.method,
            'path': request.path,
            'status': response.status_code,
            'duration_ms': duration_ms,
            'user_id': user_id,
            'trace_id': trace_id,
            'span_id': span_id,
            'request_id': request._request_id,
        }

        if response.status_code >= 500:
            logger.error("Server error", extra=log_data)
        elif response.status_code >= 400:
            logger.warning("Client error", extra=log_data)
        else:
            logger.info("Request completed", extra=log_data)

        # Log slow requests
        if duration_ms > 100:
            logger.warning("Slow request", extra={
                'event': 'slow_query',
                'duration_ms': duration_ms,
                'path': request.path,
                'method': request.method,
                'trace_id': trace_id,
            })

        return response
