from django.apps import AppConfig


def _db_metrics_wrapper(execute, sql, params, many, context):
    """Record DB query duration for Prometheus (Database Performance dashboard)."""
    import time
    from .metrics import db_query_duration_seconds
    start = time.perf_counter()
    try:
        return execute(sql, params, many, context)
    finally:
        duration = time.perf_counter() - start
        # First token is operation (SELECT, INSERT, UPDATE, DELETE, etc.)
        operation = (sql.strip().split() or ["query"])[0].upper()
        if operation not in ("SELECT", "INSERT", "UPDATE", "DELETE", "BEGIN", "COMMIT", "ROLLBACK"):
            operation = "OTHER"
        # Model/table not easily available here; use 'unknown' to keep cardinality low
        db_query_duration_seconds.labels(operation=operation, model="unknown").observe(duration)


def _install_db_wrapper(connection, **kwargs):
    """Install DB metrics wrapper on a connection (so every thread/worker gets it)."""
    if hasattr(connection, "execute_wrappers") and _db_metrics_wrapper not in connection.execute_wrappers:
        connection.execute_wrappers.append(_db_metrics_wrapper)


class TicketsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tickets'

    def ready(self):
        from django.db import connections
        from django.db.backends.signals import connection_created
        connection_created.connect(_install_db_wrapper)
        for conn in connections.all():
            _install_db_wrapper(connection=conn)
