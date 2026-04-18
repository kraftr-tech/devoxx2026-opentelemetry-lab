# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

from flask import Flask, request, jsonify
from flask_cors import CORS

from db import init_db, close_db
import service

app = Flask(__name__)
CORS(app)
app.teardown_appcontext(close_db)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/payments", methods=["POST"])
def create_payment():
    data = request.get_json()
    if not data or not data.get("user_id") or data.get("amount") is None:
        return jsonify({"error": "user_id and amount are required"}), 400

    payment, error = service.process_payment(data["user_id"], data["amount"])
    if error:
        return jsonify({"error": error, "payment_id": None}), 502
    return jsonify(payment), 201


@app.route("/payments", methods=["GET"])
def list_payments():
    return jsonify(service.get_all_payments()), 200


@app.route("/payments/<payment_id>", methods=["GET"])
def get_payment(payment_id):
    payment = service.get_payment(payment_id)
    if not payment:
        return jsonify({"error": "payment not found"}), 404
    return jsonify(payment), 200


init_db(app)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8003)
