// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"context"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otellog "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func initOtel(ctx context.Context) func() {
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("bank-service"),
		),
	)
	if err != nil {
		log.Fatalf("failed to create resource: %v", err)
	}

	// Traces — OTLP HTTP vers le collecteur (endpoint via OTEL_EXPORTER_OTLP_ENDPOINT)
	traceExporter, err := otlptracehttp.New(ctx)
	if err != nil {
		log.Fatalf("failed to create OTLP trace exporter: %v", err)
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Metrics — OTLP HTTP, export périodique toutes les 10 s
	metricExporter, err := otlpmetrichttp.New(ctx)
	if err != nil {
		log.Fatalf("failed to create OTLP metric exporter: %v", err)
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExporter, sdkmetric.WithInterval(10*time.Second))),
		sdkmetric.WithResource(res),
	)
	otel.SetMeterProvider(mp)

	// Logs — OTLP HTTP avec batch processor (bridge pour slog via otelslog)
	logExporter, err := otlploghttp.New(ctx)
	if err != nil {
		log.Fatalf("failed to create OTLP log exporter: %v", err)
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExporter)),
		sdklog.WithResource(res),
	)
	otellog.SetLoggerProvider(lp)

	return func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		tp.Shutdown(shutdownCtx)
		mp.Shutdown(shutdownCtx)
		lp.Shutdown(shutdownCtx)
	}
}
