"""Prometheus metrics endpoint."""
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST


@csrf_exempt
def metrics_view(request):
    """Expose Prometheus metrics."""
    metrics = generate_latest()
    return HttpResponse(metrics, content_type=CONTENT_TYPE_LATEST)
