"""OpenTelemetry tracing setup and helpers."""
import os
import logging

logger = logging.getLogger('tickets')


def init_tracing():
    """Initialize OpenTelemetry tracing with auto-instrumentation."""
    otel_endpoint = os.environ.get('OTEL_EXPORTER_OTLP_ENDPOINT', '')
    service_name = os.environ.get('OTEL_SERVICE_NAME', 'helpdesk-backend')

    if not otel_endpoint:
        logger.info("OTEL_EXPORTER_OTLP_ENDPOINT not set, tracing disabled")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor

        resource = Resource(attributes={
            SERVICE_NAME: service_name,
        })

        provider = TracerProvider(resource=resource)
        otlp_exporter = OTLPSpanExporter(
            endpoint=otel_endpoint,
            insecure=True,
        )
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        trace.set_tracer_provider(provider)

        # Auto-instrument Django
        DjangoInstrumentor().instrument()

        # Auto-instrument psycopg2
        Psycopg2Instrumentor().instrument()

        # Route python application logs over OTLP
        from opentelemetry._logs import set_logger_provider
        from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
        from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

        logger_provider = LoggerProvider(resource=resource)
        set_logger_provider(logger_provider)
        log_exporter = OTLPLogExporter(endpoint=otel_endpoint, insecure=True)
        logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
        
        # Attach OTLP handler specifically to our 'tickets' app logger
        otlp_handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        logging.getLogger('tickets').addHandler(otlp_handler)

        logger.info(f"OpenTelemetry tracing & logging initialized, exporting to {otel_endpoint}")

    except Exception as e:
        logger.warning(f"Failed to initialize OpenTelemetry: {e}")


def get_tracer():
    """Get the application tracer."""
    from opentelemetry import trace
    return trace.get_tracer("helpdesk-backend")
