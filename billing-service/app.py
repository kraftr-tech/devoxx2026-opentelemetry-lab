# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

from flask import Flask, request, jsonify
from flask_cors import CORS
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor

from db import init_db, close_db
from otel import setup_tracing, setup_metrics
import service

setup_tracing()
setup_metrics()

RequestsInstrumentor().instrument()
SQLite3Instrumentor().instrument()

app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)

CORS(app)
app.teardown_appcontext(close_db)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/summary", methods=["POST"])
def summary():
    data = request.get_json()
    items = data.get("items", []) if data else []
    return jsonify(service.compute_summary(items)), 200


@app.route("/checkout", methods=["POST"])
def checkout():
    data = request.get_json()
    if not data or not data.get("user_id") or not data.get("items"):
        return jsonify({"error": "user_id and items are required"}), 400

    result, error, status_code = service.checkout(data["user_id"], data["items"])
    if error:
        return jsonify(error), status_code
    return jsonify(result), status_code


@app.route("/orders/<user_id>", methods=["GET"])
def get_user_orders(user_id):
    return jsonify(service.get_user_orders(user_id)), 200


@app.route("/orders", methods=["GET"])
def get_all_orders():
    return jsonify(service.get_all_orders()), 200


init_db(app)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8004)
