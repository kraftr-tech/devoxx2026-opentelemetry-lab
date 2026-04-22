# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os
import time
from contextlib import contextmanager

import requests
from opentelemetry.trace import Status, StatusCode

from db import insert_order, find_orders_by_user, find_all_orders, find_order_items
from instruments import (
    CHECKOUT_OPERATIONS,
    CHECKOUT_ORDER_AMOUNT,
    CHECKOUT_STEP_DURATION,
    PRODUCT_SALES,
    tracer,
)

PRODUCTS_SERVICE_URL = os.environ.get("PRODUCTS_SERVICE_URL", "http://products-service:8002")
PAYMENT_SERVICE_URL = os.environ.get("PAYMENT_SERVICE_URL", "http://payment-service:8003")

SHIPPING_COST = 25.0
TAX_RATE = 0.2


@contextmanager
def _timed_step(span_name, step_label):
    """Wrap a checkout step with a child span and record step duration."""
    start = time.perf_counter()
    with tracer.start_as_current_span(span_name) as span:
        try:
            yield
        except Exception as e:
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise
        finally:
            elapsed = time.perf_counter() - start
            CHECKOUT_STEP_DURATION.record(elapsed, {"checkout.step": step_label})


def compute_summary(items):
    subtotal = sum(item.get("price", 0) * item.get("quantity", 0) for item in items)
    shipping = SHIPPING_COST if items else 0.0
    tax = round(subtotal * TAX_RATE, 2)
    total = round(subtotal + shipping + tax, 2)
    return {
        "subtotal": round(subtotal, 2),
        "shipping": shipping,
        "tax_rate": TAX_RATE,
        "tax": tax,
        "total": total,
    }


def validate_products(cart_items):
    errors = []
    validated = []
    for item in cart_items:
        try:
            res = requests.get(f"{PRODUCTS_SERVICE_URL}/products/{item['product_id']}", timeout=5)
        except requests.RequestException:
            errors.append({"product_id": item["product_id"], "error": "product service unavailable"})
            continue

        if res.status_code != 200:
            errors.append({"product_id": item["product_id"], "error": "product not found"})
            continue

        product = res.json()

        if product.get("status") != "Active":
            errors.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "error": "product is no longer available",
            })
            continue

        if product.get("stock", 0) < item["quantity"]:
            errors.append({
                "product_id": item["product_id"],
                "name": product["name"],
                "error": f"insufficient stock (requested: {item['quantity']}, available: {product['stock']})",
            })
            continue

        validated.append({"product": product, "quantity": item["quantity"]})

    return validated, errors


def process_payment(user_id, amount):
    try:
        res = requests.post(
            f"{PAYMENT_SERVICE_URL}/payments",
            json={"user_id": user_id, "amount": amount},
            timeout=15,
        )
    except requests.RequestException:
        return None, "payment service unavailable"

    data = res.json()

    if res.status_code != 201 or data.get("status") != "approved":
        return data, "payment declined"

    return data, None


def update_stock(validated_items):
    for entry in validated_items:
        product = entry["product"]
        new_stock = product["stock"] - entry["quantity"]
        requests.patch(
            f"{PRODUCTS_SERVICE_URL}/products/{product['id']}/stock",
            json={"stock": new_stock},
            timeout=5,
        )


def create_order(user_id, total, payment_id, validated_items):
    order_items = []
    for entry in validated_items:
        p = entry["product"]
        order_items.append({
            "product_id": p["id"],
            "product_name": p["name"],
            "product_image_url": p.get("image_url", ""),
            "price": p["price"],
            "quantity": entry["quantity"],
        })
    return insert_order(user_id, total, payment_id, order_items)


def checkout(user_id, cart_items):
    outcome = "error"
    total = 0.0
    try:
        with _timed_step("checkout.validate_products", "validate"):
            validated, errors = validate_products(cart_items)

        if errors:
            outcome = "validation_failed"
            return None, {"error": "checkout validation failed", "details": errors}, 409

        subtotal = sum(e["product"]["price"] * e["quantity"] for e in validated)
        tax = round(subtotal * TAX_RATE, 2)
        total = round(subtotal + SHIPPING_COST + tax, 2)

        with _timed_step("checkout.process_payment", "payment"):
            pay_data, pay_error = process_payment(user_id, total)

        if pay_error:
            outcome = "payment_declined"
            status = 502 if pay_error == "payment service unavailable" else 402
            error_detail = {
                "error": pay_error,
                "payment_id": pay_data.get("payment_id") or pay_data.get("id") if pay_data else None,
                "details": pay_data.get("error", "The bank declined the transaction") if pay_data else pay_error,
            }
            return None, error_detail, status

        with _timed_step("checkout.update_stock", "stock"):
            update_stock(validated)

        with _timed_step("checkout.persist_order", "persist"):
            order_id = create_order(user_id, total, pay_data.get("id"), validated)

        outcome = "success"
        CHECKOUT_ORDER_AMOUNT.record(total)
        for entry in validated:
            PRODUCT_SALES.add(entry["quantity"], {"product.id": entry["product"]["id"]})

        return {
            "status": "ok",
            "order_id": order_id,
            "payment_id": pay_data.get("id"),
            "total": total,
            "items": len(validated),
        }, None, 200

    finally:
        CHECKOUT_OPERATIONS.add(1, {"checkout.outcome": outcome})


def get_user_orders(user_id):
    orders = find_orders_by_user(user_id)
    return [_format_order(o) for o in orders]


def get_all_orders():
    orders = find_all_orders()
    return [_format_order(o, include_user=True) for o in orders]


def _format_order(order, include_user=False):
    items = find_order_items(order["id"])
    result = {
        "id": order["id"],
        "total": order["total"],
        "created_at": order["created_at"],
        "items": [dict(i) for i in items],
    }
    if include_user:
        result["user_id"] = order["user_id"]
    return result
