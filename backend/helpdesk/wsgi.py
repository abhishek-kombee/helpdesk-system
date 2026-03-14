"""
WSGI config for helpdesk project.
Initializes OpenTelemetry instrumentation on startup.
"""
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'helpdesk.settings')

# Initialize OpenTelemetry before Django loads
from tickets.tracing import init_tracing
init_tracing()

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
