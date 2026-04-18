# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

from db import init_db, close_db
import service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("products")

app = Flask(__name__)
CORS(app)
app.teardown_appcontext(close_db)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/products", methods=["GET"])
def list_products():
    status_filter = request.args.get("status", "Active")
    products = service.get_products(status_filter)
    logger.info(
        "products_listed",
        extra={"status_filter": status_filter, "result_count": len(products)},
    )
    return jsonify(products), 200


@app.route("/products/<product_id>", methods=["GET"])
def get_product(product_id):
    product = service.get_product(product_id)
    if not product:
        logger.warning("product_not_found", extra={"product_id": product_id})
        return jsonify({"error": "product not found"}), 404
    return jsonify(product), 200


@app.route("/products", methods=["POST"])
def create_product():
    data = request.get_json()
    if not data or not data.get("name") or not data.get("sku") or data.get("price") is None:
        logger.warning("create_product_invalid_payload")
        return jsonify({"error": "name, sku and price are required"}), 400

    product, error = service.create_product(data)
    if error:
        logger.warning(
            "create_product_conflict",
            extra={"sku": data.get("sku"), "reason": error},
        )
        return jsonify({"error": error}), 409
    logger.info(
        "product_created",
        extra={"product_id": product["id"], "sku": product["sku"]},
    )
    return jsonify(product), 201


@app.route("/products/<product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()
    product = service.update_product(product_id, data)
    if not product:
        logger.warning("product_not_found", extra={"product_id": product_id})
        return jsonify({"error": "product not found"}), 404
    logger.info("product_updated", extra={"product_id": product_id})
    return jsonify(product), 200


@app.route("/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    if not service.delete_product(product_id):
        logger.warning("product_not_found", extra={"product_id": product_id})
        return jsonify({"error": "product not found"}), 404
    logger.info("product_deleted", extra={"product_id": product_id})
    return jsonify({"deleted": product_id}), 200


@app.route("/products/<product_id>/stock", methods=["PATCH"])
def update_stock(product_id):
    data = request.get_json()
    if data.get("stock") is None:
        logger.warning("update_stock_invalid_payload", extra={"product_id": product_id})
        return jsonify({"error": "stock is required"}), 400

    product = service.update_stock(product_id, data["stock"])
    if not product:
        logger.warning("product_not_found", extra={"product_id": product_id})
        return jsonify({"error": "product not found"}), 404
    logger.info(
        "stock_updated",
        extra={"product_id": product_id, "stock": product["stock"]},
    )
    return jsonify(product), 200


init_db(app)

with app.app_context():
    service.seed_products()

logger.info("service_started", extra={"port": 8002})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8002)
