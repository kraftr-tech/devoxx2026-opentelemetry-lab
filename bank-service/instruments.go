// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

var (
	bankTracer trace.Tracer
	bankMeter  metric.Meter

	BankTransactionDuration metric.Float64Histogram
)

func initInstruments() {
	bankTracer = otel.Tracer("bank-service")
	bankMeter = otel.Meter("bank-service")

	var err error
	BankTransactionDuration, err = bankMeter.Float64Histogram(
		"bank.transaction.duration",
		metric.WithUnit("s"),
		metric.WithDescription("Durée des transactions bancaires simulées, par outcome"),
	)
	if err != nil {
		log.Fatalf("failed to create bank.transaction.duration histogram: %v", err)
	}
}
