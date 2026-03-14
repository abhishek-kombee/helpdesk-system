"""Health check endpoint."""
import time
from django.http import JsonResponse
from django.db import connection


def health_check(request):
    """Return application health status."""
    health = {
        'status': 'healthy',
        'timestamp': time.time(),
        'checks': {}
    }

    # Database check
    try:
        start = time.time()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_duration = round((time.time() - start) * 1000, 2)
        health['checks']['database'] = {
            'status': 'up',
            'duration_ms': db_duration,
        }
    except Exception as e:
        health['status'] = 'unhealthy'
        health['checks']['database'] = {
            'status': 'down',
            'error': str(e),
        }

    status_code = 200 if health['status'] == 'healthy' else 503
    return JsonResponse(health, status=status_code)
