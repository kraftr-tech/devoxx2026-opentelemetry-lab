# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

from opentelemetry import metrics, trace
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor


def _resource() -> Resource:
    """Shared resource for all signals — same service.name everywhere."""
    return Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "users-service"),
        "service.version": os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
    })


def setup_tracing() -> None:
    """Configure the global TracerProvider. Call once at process startup."""
    provider = TracerProvider(resource=_resource())
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)


def setup_metrics() -> None:
    """Configure the global MeterProvider. Call once at process startup."""
    reader = PeriodicExportingMetricReader(
        ConsoleMetricExporter(),
        export_interval_millis=10_000,
    )
    provider = MeterProvider(
        resource=_resource(),
        metric_readers=[reader],
    )
    metrics.set_meter_provider(provider)
