// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"log"
	"net"

	pb "bank-service/pb"

	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
)

func main() {
	ctx := context.Background()

	setupLogger()

	shutdown := initOtel(ctx)
	defer shutdown()

	port := ":50051"
	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	s := grpc.NewServer(
		grpc.StatsHandler(otelgrpc.NewServerHandler()),
	)
	pb.RegisterTransactionServiceServer(s, &transactionHandler{})

	logger.InfoContext(ctx, "Bank service started", "port", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
