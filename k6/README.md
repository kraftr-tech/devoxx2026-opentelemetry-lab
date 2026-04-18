# k6 load tests

> Part of the [Devoxx FR 2026 OpenTelemetry lab](../README.md) — see [docs/](../docs/README.md) for the full documentation.

Simple client journey for the Atelier stack: login → list products → add to cart → checkout.

## Prerequisites

- `mise install` (k6 is declared in `mise.toml`)
- Stack running: `docker compose up --build`

## Run

```bash
task load:client-journey
# or directly:
k6 run k6/client-journey.js
```

## Overrides

```bash
USERS_URL=http://localhost:8001 \
PRODUCTS_URL=http://localhost:8002 \
BILLING_URL=http://localhost:8004 \
EMAIL=john.doe@kraftr.tech \
PASSWORD=client123 \
k6 run k6/client-journey.js
```

## Expected outcomes

- `checkout_approved`: bank approved the transaction
- `checkout_declined` (402): bank declined (~10% decline rate simulated)
- `checkout_stock_ko` (409): stock exhausted by the load (seed stocks are small)

These non-200 responses are business outcomes, not errors.
