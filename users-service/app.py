# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

from flask import Flask, request, jsonify
from flask_cors import CORS
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor

from db import init_db, close_db
from otel import setup_tracing, setup_metrics
import service

setup_tracing()
setup_metrics()

SQLite3Instrumentor().instrument()

app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)

CORS(app)
app.teardown_appcontext(close_db)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# --- Users ---

@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password") or not data.get("name"):
        return jsonify({"error": "email, name and password are required"}), 400

    user, error = service.create_user(data["email"], data["name"], data["password"], data.get("role", "client"))
    if error:
        return jsonify({"error": error}), 409
    return jsonify(user), 201


@app.route("/users/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"error": "email and password are required"}), 400

    user = service.authenticate(data["email"], data["password"])
    if not user:
        return jsonify({"error": "invalid credentials"}), 401
    return jsonify(user), 200


@app.route("/users", methods=["GET"])
def list_users():
    return jsonify(service.get_all_users()), 200


@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    user = service.get_user(user_id)
    if not user:
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
        return jsonify({"error": "product_id and quantity are required"}), 400

    return jsonify(service.add_to_cart(user_id, data["product_id"], data["quantity"])), 200


@app.route("/users/<user_id>/cart/<product_id>", methods=["PUT"])
def update_cart_item(user_id, product_id):
    data = request.get_json()
    if data.get("quantity") is None:
        return jsonify({"error": "quantity is required"}), 400

    return jsonify(service.update_cart(user_id, product_id, data["quantity"])), 200


@app.route("/users/<user_id>/cart/<product_id>", methods=["DELETE"])
def remove_from_cart(user_id, product_id):
    return jsonify(service.remove_from_cart(user_id, product_id)), 200


@app.route("/users/<user_id>/cart", methods=["DELETE"])
def clear_cart(user_id):
    service.clear_cart(user_id)
    return jsonify([]), 200


init_db(app)

with app.app_context():
    service.seed_users()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8001)
