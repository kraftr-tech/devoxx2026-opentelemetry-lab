# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging

from opentelemetry import metrics
from opentelemetry.metrics import CallbackOptions, Observation

from db import list_stock_for_gauge, list_product_info

log = logging.getLogger(__name__)
meter = metrics.get_meter("products-service")


def _observe_stock(options: CallbackOptions):
    """Called by the SDK on each export cycle (every 10s). Must never raise."""
    try:
        return [
            Observation(stock, {"product.id": product_id})
            for product_id, stock in list_stock_for_gauge()
        ]
    except Exception:
        log.exception("product.stock callback failed")
        return []


PRODUCT_STOCK = meter.create_observable_gauge(
    "product.stock",
    callbacks=[_observe_stock],
    unit="{item}",
    description="Stock courant par produit",
)


def _observe_product_info(options: CallbackOptions):
    try:
        return [
            Observation(
                1,
                {
                    "product.id": p["id"],
                    "product.name": p["name"],
                    "product.category": p["category"],
                },
            )
            for p in list_product_info()
        ]
    except Exception:
        log.exception("product.info callback failed")
        return []


PRODUCT_INFO = meter.create_observable_gauge(
    "product.info",
    callbacks=[_observe_product_info],
    description="Métadonnées produit (toujours 1, à joindre avec les autres métriques sur product_id)",
)
