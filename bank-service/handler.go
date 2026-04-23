// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"log"

	pb "bank-service/pb"
	"google.golang.org/grpc/metadata"
)

type transactionHandler struct {
	pb.UnimplementedTransactionServiceServer
}

func (h *transactionHandler) ProcessTransaction(ctx context.Context, req *pb.TransactionRequest) (*pb.TransactionResponse, error) {
	logger.InfoContext(ctx, "Processing transaction",
		"merchant_id", req.MerchantId,
		"amount", req.Amount,
	)

	if md, ok := metadata.FromIncomingContext(ctx); ok {
        log.Printf("incoming metadata: %v", md)
    }

	result := ProcessTransaction(ctx, req.MerchantId, req.Amount)

	logger.InfoContext(ctx, "Transaction completed",
		"transaction_id", result.TransactionID,
		"status", result.Status,
	)

	return &pb.TransactionResponse{
		Id:            result.ID,
		TransactionId: result.TransactionID,
		MerchantId:    result.MerchantID,
		Amount:        result.Amount,
		Status:        result.Status,
		CreatedAt:     result.CreatedAt,
	}, nil
}
