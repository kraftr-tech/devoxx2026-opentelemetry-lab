# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging
import os

from opentelemetry import _logs, metrics, trace
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor, ConsoleLogExporter
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
        "service.name": os.getenv("OTEL_SERVICE_NAME", "billing-service"),
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


def setup_logging() -> None:
    """Configure the global LoggerProvider and bridge stdlib logging to it."""
    provider = LoggerProvider(resource=_resource())
    provider.add_log_record_processor(BatchLogRecordProcessor(ConsoleLogExporter()))
    _logs.set_logger_provider(provider)

    # Le root logger Python est à WARNING par défaut — les INFO seraient filtrés
    # AVANT d'atteindre les handlers attachés. On abaisse le seuil à INFO.
    logging.getLogger().setLevel(logging.INFO)

    # Branche stdlib Python logging → OTel LoggerProvider
    handler = LoggingHandler(level=logging.INFO, logger_provider=provider)
    logging.getLogger().addHandler(handler)
