# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter


def setup_tracing() -> None:
    """Configure the global TracerProvider. Call once at process startup."""
    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "payment-service"),
        "service.version": os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
    })

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        SimpleSpanProcessor(ConsoleSpanExporter())
    )
    trace.set_tracer_provider(provider)
