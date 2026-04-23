// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"log"
	"math/rand"
	"os"
	"strconv"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type chaosConfig struct {
	enabled          bool
	probability      float64
	latencyMaxMs     int
	errorProbability float64
}

func loadChaosConfig() chaosConfig {
	return chaosConfig{
		enabled:          os.Getenv("CHAOS_ENABLED") == "true",
		probability:      parseFloat(os.Getenv("CHAOS_PROBABILITY"), 0.3),
		latencyMaxMs:     parseInt(os.Getenv("CHAOS_LATENCY_MAX_MS"), 800),
		errorProbability: parseFloat(os.Getenv("CHAOS_ERROR_PROBABILITY"), 0.05),
	}
}

func parseFloat(s string, def float64) float64 {
	if v, err := strconv.ParseFloat(s, 64); err == nil {
		return v
	}
	return def
}

func parseInt(s string, def int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return def
}

func chaosUnaryInterceptor(cfg chaosConfig) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !cfg.enabled || rand.Float64() >= cfg.probability {
			return handler(ctx, req)
		}
		if rand.Float64() < cfg.errorProbability {
			log.Printf("chaos: injecting Unavailable error on %s", info.FullMethod)
			return nil, status.Error(codes.Unavailable, "chaos monkey says no")
		}
		delayMs := rand.Intn(cfg.latencyMaxMs-50) + 50
		log.Printf("chaos: injecting %dms latency on %s", delayMs, info.FullMethod)
		time.Sleep(time.Duration(delayMs) * time.Millisecond)
		return handler(ctx, req)
	}
}
