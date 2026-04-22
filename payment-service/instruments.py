# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

from opentelemetry import metrics, trace

tracer = trace.get_tracer("payment-service")
meter = metrics.get_meter("payment-service")

PAYMENT_DECLINES = meter.create_counter(
    "payment.declines",
    unit="{payment}",
    description="Paiements déclinés, par raison",
)
