# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import sqlite3
import uuid
import os

from flask import g

DATABASE = os.environ.get("DATABASE_PATH", "/data/payments.db")


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
            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                transaction_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.commit()


def insert_payment(user_id, amount):
    payment_id = str(uuid.uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO payments (id, user_id, amount, status) VALUES (?, ?, ?, ?)",
        (payment_id, user_id, amount, "pending"),
    )
    db.commit()
    return payment_id


def update_payment_status(payment_id, status, transaction_id=None):
    db = get_db()
    db.execute(
        "UPDATE payments SET status=?, transaction_id=? WHERE id=?",
        (status, transaction_id, payment_id),
    )
    db.commit()


def find_payment_by_id(payment_id):
    return get_db().execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()


def list_all_payments():
    return get_db().execute("SELECT * FROM payments ORDER BY created_at DESC").fetchall()
