# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import sqlite3
import uuid
import os

from flask import g

DATABASE = os.environ.get("DATABASE_PATH", "/data/users.db")


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
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'client',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS cart_items (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, product_id)
            )
            """
        )
        db.commit()


def find_user_by_id(user_id):
    return get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def find_user_by_email(email):
    return get_db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def list_all_users():
    return get_db().execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()


def count_users():
    return get_db().execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]


def insert_user(email, name, password_hash, role="client"):
    user_id = str(uuid.uuid4())
    get_db().execute(
        "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)",
        (user_id, email, name, password_hash, role),
    )
    get_db().commit()
    return user_id


def get_cart_items(user_id):
    return get_db().execute(
        "SELECT product_id, quantity FROM cart_items WHERE user_id = ?", (user_id,)
    ).fetchall()


def find_cart_item(user_id, product_id):
    return get_db().execute(
        "SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?",
        (user_id, product_id),
    ).fetchone()


def upsert_cart_item(user_id, product_id, quantity):
    db = get_db()
    existing = find_cart_item(user_id, product_id)
    if existing:
        db.execute(
            "UPDATE cart_items SET quantity = ? WHERE id = ?",
            (existing["quantity"] + quantity, existing["id"]),
        )
    else:
        db.execute(
            "INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, product_id, quantity),
        )
    db.commit()


def update_cart_item_quantity(user_id, product_id, quantity):
    db = get_db()
    if quantity <= 0:
        db.execute("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    else:
        db.execute(
            "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?",
            (quantity, user_id, product_id),
        )
    db.commit()


def delete_cart_item(user_id, product_id):
    db = get_db()
    db.execute("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?", (user_id, product_id))
    db.commit()


def clear_cart_items(user_id):
    db = get_db()
    db.execute("DELETE FROM cart_items WHERE user_id = ?", (user_id,))
    db.commit()
