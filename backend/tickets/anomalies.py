"""
Injectable anomalies for testing observability.
Toggle via environment variables in .env:
  - INJECT_DELAY=true       -> adds artificial delay to ticket list
  - INJECT_SLOW_QUERY=true  -> uses unoptimized raw SQL for ticket list
  - INJECT_ERRORS=true      -> 20% of /api/tickets/ requests return 500
"""
import os
import time
import random
import logging
from django.http import JsonResponse

logger = logging.getLogger('tickets')


def should_inject_delay():
    return os.environ.get('INJECT_DELAY', 'false').lower() == 'true'


def should_inject_slow_query():
    return os.environ.get('INJECT_SLOW_QUERY', 'false').lower() == 'true'


def should_inject_errors():
    return os.environ.get('INJECT_ERRORS', 'false').lower() == 'true'


def inject_artificial_delay():
    """Add a random delay between 0.5 and 2.0 seconds."""
    if should_inject_delay():
        delay = random.uniform(0.5, 2.0)
        logger.warning("Injecting artificial delay", extra={
            'event': 'anomaly_injected',
            'anomaly_type': 'delay',
            'delay_seconds': round(delay, 3),
        })
        time.sleep(delay)


def inject_slow_query():
    """Return a raw SQL query with no index optimization."""
    if should_inject_slow_query():
        from django.db import connection
        logger.warning("Injecting slow query", extra={
            'event': 'anomaly_injected',
            'anomaly_type': 'slow_query',
        })
        with connection.cursor() as cursor:
            # Deliberately unoptimized query - full table scan with string comparison
            cursor.execute("""
                SELECT t.*, u.username 
                FROM tickets t 
                LEFT JOIN users u ON t.created_by_id = u.id 
                WHERE CAST(t.id AS TEXT) LIKE '%%' 
                ORDER BY t.description, t.title, t.created_at
            """)
            return cursor.fetchall()
    return None


def inject_random_error(request):
    """20% chance of returning a 500 error."""
    if should_inject_errors() and random.random() < 0.2:
        logger.error("Injecting random 500 error", extra={
            'event': 'anomaly_injected',
            'anomaly_type': 'random_500',
            'path': request.path,
        })
        return JsonResponse(
            {'error': 'Internal server error (injected anomaly)'},
            status=500
        )
    return None
