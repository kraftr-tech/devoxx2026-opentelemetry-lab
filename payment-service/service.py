# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

import grpc
import transaction_pb2
import transaction_pb2_grpc

from db import (
    insert_payment,
    update_payment_status,
    find_payment_by_id,
    list_all_payments,
)

BANK_SERVICE_HOST = os.environ.get("BANK_SERVICE_HOST", "bank-service:50051")


def row_to_dict(row):
    return dict(row)


def process_payment(user_id, amount):
    payment_id = insert_payment(user_id, amount)

    try:
        channel = grpc.insecure_channel(BANK_SERVICE_HOST)
        stub = transaction_pb2_grpc.TransactionServiceStub(channel)
        grpc_request = transaction_pb2.TransactionRequest(
            merchant_id="atelier-store",
            amount=amount,
        )
        grpc_response = stub.ProcessTransaction(grpc_request, timeout=10)

        update_payment_status(payment_id, grpc_response.status, grpc_response.transaction_id)
        payment = find_payment_by_id(payment_id)
        return row_to_dict(payment), None

    except grpc.RpcError as e:
        update_payment_status(payment_id, "failed")
        return None, f"bank transaction failed: {e.details()}"


def get_payment(payment_id):
    payment = find_payment_by_id(payment_id)
    if not payment:
        return None
    return row_to_dict(payment)


def get_all_payments():
    return [row_to_dict(p) for p in list_all_payments()]
