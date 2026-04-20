// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"log/slog"

	"go.opentelemetry.io/contrib/bridges/otelslog"
)

func initLogger() *slog.Logger {
	// Bridge stdlib slog → OTel LoggerProvider (configuré dans initOtel).
	return otelslog.NewLogger("bank-service")
}

var logger = slog.Default()

func setupLogger() {
	logger = initLogger()
}
