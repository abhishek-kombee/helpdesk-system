from django.contrib import admin
from django.urls import path, include
from tickets.health import health_check
from tickets.metrics_view import metrics_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('tickets.urls')),
    path('health/', health_check, name='health'),
    path('metrics', metrics_view, name='metrics'),
]
