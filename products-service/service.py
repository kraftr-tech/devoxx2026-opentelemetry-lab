# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging
import sqlite3

from db import (
    count_products,
    insert_product,
    find_product_by_id,
    list_products as db_list_products,
    update_product as db_update_product,
    delete_product as db_delete_product,
    update_stock as db_update_stock,
)

logger = logging.getLogger("products.service")


def row_to_dict(row):
    return dict(row)


def seed_products():
    if count_products() > 0:
        return
    logger.info("seeding_products")
    seed_data = [
        ("Sculpted Wool Overcoat", "SWO-001-CHR", "Premium sculpted overcoat in charcoal melange wool.", 890.00, 24, "Active", "Outerwear", "https://picsum.photos/seed/wool-overcoat/800/1000"),
        ("Organic Silk Shell", "OSS-002-PAR", "Lightweight organic silk shell in parchment.", 320.00, 18, "Active", "Tops", "https://picsum.photos/seed/silk-shell/800/1000"),
        ("L'Atelier Signature V1", "SIG-V1-BLK", "Hand-finished full grain leather footwear.", 425.00, 35, "Active", "Footwear", "https://picsum.photos/seed/signature-v1/800/1000"),
        ("T10 Chronograph", "T10-CHR-SLV", "Precision chronograph with sapphire crystal.", 450.00, 12, "Active", "Accessories", "https://picsum.photos/seed/watch-1/500/500"),
        ("Standard Tote", "STD-TOT-BLK", "Hand-burnished leather tote bag.", 1200.00, 8, "Active", "Bags", "https://picsum.photos/seed/tote-1/500/500"),
        ("Luxe Chronograph X1", "LUX-482-WATCH", "Premium luxury chronograph.", 1250.00, 12, "Active", "Accessories", "https://picsum.photos/seed/prod-1/100/100"),
        ("Velocity Sport 2.0", "VEL-009-RED", "Athletic performance footwear.", 180.00, 156, "Active", "Footwear", "https://picsum.photos/seed/prod-2/100/100"),
        ("Essentials Cotton Tee", "ESS-TEE-WHT", "Minimal cotton essential tee.", 45.00, 0, "Inactive", "Tops", "https://picsum.photos/seed/prod-3/100/100"),
    ]
    for name, sku, desc, price, stock, status, category, image in seed_data:
        insert_product(name, sku, desc, price, stock, status, category, image)
    logger.info("products_seeded", extra={"count": len(seed_data)})


def get_products(status_filter="Active"):
    return [row_to_dict(p) for p in db_list_products(status_filter)]


def get_product(product_id):
    product = find_product_by_id(product_id)
    if not product:
        return None
    return row_to_dict(product)


def create_product(data):
    try:
        product_id = insert_product(
            data["name"], data["sku"], data.get("description", ""),
            data["price"], data.get("stock", 0), data.get("status", "Active"),
            data.get("category", ""), data.get("image_url", ""),
        )
    except sqlite3.IntegrityError:
        logger.warning("duplicate_sku", extra={"sku": data.get("sku")})
        return None, "sku already exists"
    return row_to_dict(find_product_by_id(product_id)), None


def update_product(product_id, data):
    updated = db_update_product(product_id, **data)
    if not updated:
        return None
    return row_to_dict(updated)


def delete_product(product_id):
    product = find_product_by_id(product_id)
    if not product:
        return False
    db_delete_product(product_id)
    return True


def update_stock(product_id, stock):
    product = find_product_by_id(product_id)
    if not product:
        return None
    updated = db_update_stock(product_id, stock)
    return row_to_dict(updated)
