# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

import grpc
import transaction_pb2
import transaction_pb2_grpc
from opentelemetry.trace import Status, StatusCode

from db import (
    insert_payment,
    update_payment_status,
    find_payment_by_id,
    list_all_payments,
)
from instruments import PAYMENT_DECLINES, tracer

BANK_SERVICE_HOST = os.environ.get("BANK_SERVICE_HOST", "bank-service:50051")


def row_to_dict(row):
    return dict(row)


def process_payment(user_id, amount):
    payment_id = insert_payment(user_id, amount)

    with tracer.start_as_current_span("payment.process") as span:
        span.set_attribute("payment.amount", amount)

        try:
            channel = grpc.insecure_channel(BANK_SERVICE_HOST)
            stub = transaction_pb2_grpc.TransactionServiceStub(channel)
            grpc_request = transaction_pb2.TransactionRequest(
                merchant_id="atelier-store",
                amount=amount,
            )
            grpc_response = stub.ProcessTransaction(grpc_request, timeout=10)

            update_payment_status(payment_id, grpc_response.status, grpc_response.transaction_id)

            if grpc_response.status == "declined":
                reason = grpc_response.decline_reason or "unknown"
                span.set_attribute("payment.outcome", "declined")
                span.set_attribute("payment.decline.reason", reason)
                PAYMENT_DECLINES.add(1, {"payment.decline.reason": reason})
            else:
                span.set_attribute("payment.outcome", "approved")

            payment = find_payment_by_id(payment_id)
            return row_to_dict(payment), None

        except grpc.RpcError as e:
            update_payment_status(payment_id, "failed")
            span.set_attribute("payment.outcome", "declined")
            span.set_attribute("payment.decline.reason", "bank_unreachable")
            span.record_exception(e)
            span.set_status(Status(StatusCode.ERROR, str(e)))
            PAYMENT_DECLINES.add(1, {"payment.decline.reason": "bank_unreachable"})
            return None, f"bank transaction failed: {e.details()}"


def get_payment(payment_id):
    payment = find_payment_by_id(payment_id)
    if not payment:
        return None
    return row_to_dict(payment)


def get_all_payments():
    return [row_to_dict(p) for p in list_all_payments()]
