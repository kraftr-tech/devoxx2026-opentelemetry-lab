// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

var declineReasons = []string{
	"insufficient_funds",
	"card_expired",
	"fraud_suspected",
	"issuer_unreachable",
}

type TransactionResult struct {
	ID            int32
	TransactionID string
	MerchantID    string
	Amount        float64
	Status        string
	CreatedAt     string
	DeclineReason string
}

func ProcessTransaction(ctx context.Context, merchantID string, amount float64) TransactionResult {
	start := time.Now()

	time.Sleep(time.Duration(100+rand.Intn(400)) * time.Millisecond)

	transactionID := fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	status := "approved"
	declineReason := ""

	if rand.Float64() < 0.1 {
		status = "declined"
		declineReason = declineReasons[rand.Intn(len(declineReasons))]
	}

	elapsed := time.Since(start).Seconds()

	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.String("transaction.outcome", status))
	if declineReason != "" {
		span.SetAttributes(attribute.String("payment.decline.reason", declineReason))
	}

	BankTransactionDuration.Record(ctx, elapsed,
		metric.WithAttributes(attribute.String("transaction.outcome", status)),
	)

	return TransactionResult{
		ID:            int32(rand.Intn(100000)),
		TransactionID: transactionID,
		MerchantID:    merchantID,
		Amount:        amount,
		Status:        status,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
		DeclineReason: declineReason,
	}
}
