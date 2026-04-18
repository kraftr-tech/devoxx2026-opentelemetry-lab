// SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
// SPDX-License-Identifier: MIT

package main

import (
	"log/slog"
	"os"

)

func initLogger() *slog.Logger {
	return slog.New(
		slog.NewTextHandler(os.Stderr, nil),
	)
}

var logger = slog.New(slog.NewTextHandler(os.Stderr, nil))

func setupLogger() {
	logger = initLogger()
}
