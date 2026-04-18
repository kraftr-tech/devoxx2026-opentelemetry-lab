# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import sqlite3
import uuid
import os

from flask import g

DATABASE = os.environ.get("DATABASE_PATH", "/data/billing.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app):
    with app.app_context():
        db = get_db()
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                total REAL NOT NULL,
                payment_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS order_items (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                product_name TEXT NOT NULL,
                product_image_url TEXT DEFAULT '',
                price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            )
            """
        )
        db.commit()


def insert_order(user_id, total, payment_id, items):
    db = get_db()
    order_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO orders (id, user_id, total, payment_id) VALUES (?, ?, ?, ?)",
        (order_id, user_id, total, payment_id),
    )
    for item in items:
        db.execute(
            "INSERT INTO order_items (id, order_id, product_id, product_name, product_image_url, price, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), order_id, item["product_id"], item["product_name"],
             item.get("product_image_url", ""), item["price"], item["quantity"]),
        )
    db.commit()
    return order_id


def find_orders_by_user(user_id):
    return get_db().execute(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()


def find_all_orders():
    return get_db().execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()


def find_order_items(order_id):
    return get_db().execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
