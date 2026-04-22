# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

from opentelemetry import metrics, trace

tracer = trace.get_tracer("billing-service")
meter = metrics.get_meter("billing-service")

CHECKOUT_OPERATIONS = meter.create_counter(
    "checkout.operations",
    unit="{checkout}",
    description="Checkouts tentés, par outcome",
)

CHECKOUT_ORDER_AMOUNT = meter.create_histogram(
    "checkout.order.amount",
    unit="EUR",
    description="Montant des checkouts réussis",
)

CHECKOUT_STEP_DURATION = meter.create_histogram(
    "checkout.step.duration",
    unit="s",
    description="Latence par étape du checkout",
)

PRODUCT_SALES = meter.create_counter(
    "product.sales",
    unit="{item}",
    description="Articles vendus (source : checkouts réussis)",
)
