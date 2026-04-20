# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging

from flask import Flask, request, jsonify
from flask_cors import CORS
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor

from db import init_db, close_db
from otel import setup_tracing, setup_metrics, setup_logging
import service

setup_tracing()
setup_metrics()
setup_logging()

SQLite3Instrumentor().instrument()
LoggingInstrumentor().instrument(set_logging_format=True)

app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)

CORS(app)
app.teardown_appcontext(close_db)

logger = logging.getLogger("users")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# --- Users ---

@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password") or not data.get("name"):
        logger.warning("create_user_invalid_payload")
        return jsonify({"error": "email, name and password are required"}), 400

    user, error = service.create_user(data["email"], data["name"], data["password"], data.get("role", "client"))
    if error:
        logger.warning(
            "create_user_conflict",
            extra={"email": data["email"], "reason": error},
        )
        return jsonify({"error": error}), 409
    logger.info(
        "user_created",
        extra={"user_id": user["id"], "email": user["email"], "role": user.get("role")},
    )
    return jsonify(user), 201


@app.route("/users/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        logger.warning("login_invalid_payload")
        return jsonify({"error": "email and password are required"}), 400

    user = service.authenticate(data["email"], data["password"])
    if not user:
        logger.warning("login_failed", extra={"email": data["email"]})
        return jsonify({"error": "invalid credentials"}), 401
    logger.info("login_success", extra={"user_id": user["id"], "email": user["email"]})
    return jsonify(user), 200


@app.route("/users", methods=["GET"])
def list_users():
    return jsonify(service.get_all_users()), 200


@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = service.get_user(user_id)
    if not user:
        logger.warning("user_not_found", extra={"user_id": user_id})
        return jsonify({"error": "user not found"}), 404
    return jsonify(user), 200


# --- Cart ---

@app.route("/users/<user_id>/cart", methods=["GET"])
def get_cart(user_id):
    return jsonify(service.get_cart(user_id)), 200


@app.route("/users/<user_id>/cart", methods=["POST"])
def add_to_cart(user_id):
    data = request.get_json()
    if not data or not data.get("product_id") or data.get("quantity") is None:
        logger.warning("add_to_cart_invalid_payload", extra={"user_id": user_id})
        return jsonify({"error": "product_id and quantity are required"}), 400

    logger.info(
        "cart_item_added",
        extra={"user_id": user_id, "product_id": data["product_id"], "quantity": data["quantity"]},
    )
    return jsonify(service.add_to_cart(user_id, data["product_id"], data["quantity"])), 200


@app.route("/users/<user_id>/cart/<product_id>", methods=["PUT"])
def update_cart_item(user_id, product_id):
    data = request.get_json()
    if data.get("quantity") is None:
        logger.warning("update_cart_invalid_payload", extra={"user_id": user_id, "product_id": product_id})
        return jsonify({"error": "quantity is required"}), 400

    logger.info(
        "cart_item_updated",
        extra={"user_id": user_id, "product_id": product_id, "quantity": data["quantity"]},
    )
    return jsonify(service.update_cart(user_id, product_id, data["quantity"])), 200


@app.route("/users/<user_id>/cart/<product_id>", methods=["DELETE"])
def remove_from_cart(user_id, product_id):
    logger.info("cart_item_removed", extra={"user_id": user_id, "product_id": product_id})
    return jsonify(service.remove_from_cart(user_id, product_id)), 200


@app.route("/users/<user_id>/cart", methods=["DELETE"])
def clear_cart(user_id):
    service.clear_cart(user_id)
    logger.info("cart_cleared", extra={"user_id": user_id})
    return jsonify([]), 200


init_db(app)

with app.app_context():
    service.seed_users()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001)
