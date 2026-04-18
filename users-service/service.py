# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import hashlib
import sqlite3

from db import (
    find_user_by_id,
    find_user_by_email,
    list_all_users,
    count_users,
    insert_user,
    get_cart_items,
    upsert_cart_item,
    update_cart_item_quantity,
    delete_cart_item,
    clear_cart_items,
)


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def row_to_dict(row):
    d = dict(row)
    d.pop("password_hash", None)
    return d


def seed_users():
    if count_users() > 0:
        return
    seed_data = [
        ("admin@kraftr.tech", "Admin", "admin123", "admin"),
        ("john.doe@kraftr.tech", "John Doe", "client123", "client"),
    ]
    for email, name, password, role in seed_data:
        insert_user(email, name, hash_password(password), role)


def create_user(email, name, password, role="client"):
    try:
        user_id = insert_user(email, name, hash_password(password), role)
    except sqlite3.IntegrityError:
        return None, "email already exists"
    user = find_user_by_id(user_id)
    return row_to_dict(user), None


def authenticate(email, password):
    user = find_user_by_email(email)
    if not user or user["password_hash"] != hash_password(password):
        return None
    return row_to_dict(user)


def get_all_users():
    return [row_to_dict(u) for u in list_all_users()]


def get_user(user_id):
    user = find_user_by_id(user_id)
    if not user:
        return None
    return row_to_dict(user)


def get_cart(user_id):
    return [dict(i) for i in get_cart_items(user_id)]


def add_to_cart(user_id, product_id, quantity):
    upsert_cart_item(user_id, product_id, quantity)
    return get_cart(user_id)


def update_cart(user_id, product_id, quantity):
    update_cart_item_quantity(user_id, product_id, quantity)
    return get_cart(user_id)


def remove_from_cart(user_id, product_id):
    delete_cart_item(user_id, product_id)
    return get_cart(user_id)


def clear_cart(user_id):
    clear_cart_items(user_id)
