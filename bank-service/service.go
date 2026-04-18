// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"
)


type TransactionResult struct {
	ID            int32
	TransactionID string
	MerchantID    string
	Amount        float64
	Status        string
	CreatedAt     string
}

func ProcessTransaction(ctx context.Context, merchantID string, amount float64) TransactionResult {
	// Simulate processing delay
	time.Sleep(time.Duration(100+rand.Intn(400)) * time.Millisecond)

	transactionID := fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	status := "approved"

	// Simulate occasional declined transactions (~10%)
	if rand.Float64() < 0.1 {
		status = "declined"
	}

	return TransactionResult{
		ID:            int32(rand.Intn(100000)),
		TransactionID: transactionID,
		MerchantID:    merchantID,
		Amount:        amount,
		Status:        status,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	}
}
