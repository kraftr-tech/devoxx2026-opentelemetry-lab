# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import logging
import os
import random
import time

from flask import abort
from opentelemetry import trace

log = logging.getLogger("chaos")
tracer = trace.get_tracer("chaos")

ENABLED = os.getenv("CHAOS_ENABLED", "false").lower() == "true"
PROBABILITY = float(os.getenv("CHAOS_PROBABILITY", "0.3"))
LATENCY_MAX_MS = int(os.getenv("CHAOS_LATENCY_MAX_MS", "800"))
ERROR_PROBABILITY = float(os.getenv("CHAOS_ERROR_PROBABILITY", "0.05"))


def install(app):
    if not ENABLED:
        return

    @app.before_request
    def _inject_chaos():
        if random.random() >= PROBABILITY:
            return
        with tracer.start_as_current_span("chaos.inject") as span:
            if random.random() < ERROR_PROBABILITY:
                span.set_attribute("chaos.kind", "error")
                log.warning("chaos: injecting 500 error")
                abort(500, description="chaos monkey says no")
            delay_ms = random.randint(50, LATENCY_MAX_MS)
            span.set_attribute("chaos.kind", "latency")
            span.set_attribute("chaos.delay_ms", delay_ms)
            log.warning("chaos: injecting %dms latency", delay_ms)
            time.sleep(delay_ms / 1000.0)
