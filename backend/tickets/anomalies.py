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
    """Add a huge random delay between 3.0 and 5.0 seconds."""
    if should_inject_delay():
        delay = random.uniform(3.0, 5.0)
        logger.warning("Injecting artificial delay", extra={
            'event': 'anomaly_injected',
            'anomaly_type': 'delay',
            'delay_seconds': round(delay, 3),
        })
        time.sleep(delay)


def inject_slow_query():
    """Return an incredibly slow unoptimized query using a CROSS JOIN to force a massive delay."""
    if should_inject_slow_query():
        from django.db import connection
        logger.warning("Injecting slow query", extra={
            'event': 'anomaly_injected',
            'anomaly_type': 'slow_query',
        })
        with connection.cursor() as cursor:
            # Deliberately terrible query - a cross join that explodes row count
            cursor.execute("""
                SELECT t1.id, t2.id, u.username 
                FROM tickets t1 
                CROSS JOIN tickets t2 
                LEFT JOIN users u ON t1.created_by_id = u.id 
                WHERE CAST(t1.id AS TEXT) LIKE '%%' OR CAST(t2.id AS TEXT) LIKE '%%'
                ORDER BY t1.description DESC, t2.title ASC
                LIMIT 100
            """)
            return cursor.fetchall()
    return None


def inject_random_error(request):
    """50% chance of returning a 500 error."""
    if should_inject_errors() and random.random() < 0.5:
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
