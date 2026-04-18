# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import sqlite3
import uuid
import os

from flask import g

DATABASE = os.environ.get("DATABASE_PATH", "/data/products.db")


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
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Active',
                category TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.commit()


def count_products():
    return get_db().execute("SELECT COUNT(*) as c FROM products").fetchone()["c"]


def insert_product(name, sku, description, price, stock, status, category, image_url):
    product_id = str(uuid.uuid4())
    get_db().execute(
        "INSERT INTO products (id, name, sku, description, price, stock, status, category, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (product_id, name, sku, description, price, stock, status, category, image_url),
    )
    get_db().commit()
    return product_id


def find_product_by_id(product_id):
    return get_db().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()


def list_products(status_filter=None):
    if status_filter and status_filter != "all":
        return get_db().execute(
            "SELECT * FROM products WHERE status = ? ORDER BY created_at DESC", (status_filter,)
        ).fetchall()
    return get_db().execute("SELECT * FROM products ORDER BY created_at DESC").fetchall()


def update_product(product_id, **fields):
    product = find_product_by_id(product_id)
    if not product:
        return None
    db = get_db()
    db.execute(
        "UPDATE products SET name=?, description=?, price=?, stock=?, status=?, category=?, image_url=? WHERE id=?",
        (
            fields.get("name", product["name"]),
            fields.get("description", product["description"]),
            fields.get("price", product["price"]),
            fields.get("stock", product["stock"]),
            fields.get("status", product["status"]),
            fields.get("category", product["category"]),
            fields.get("image_url", product["image_url"]),
            product_id,
        ),
    )
    db.commit()
    return find_product_by_id(product_id)


def delete_product(product_id):
    db = get_db()
    db.execute("DELETE FROM products WHERE id = ?", (product_id,))
    db.commit()


def update_stock(product_id, stock):
    db = get_db()
    db.execute("UPDATE products SET stock=? WHERE id=?", (stock, product_id))
    db.commit()
    return find_product_by_id(product_id)
