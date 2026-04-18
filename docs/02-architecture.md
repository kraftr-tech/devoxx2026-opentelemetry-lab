# Architecture

**Atelier** est une application e-commerce composée de 5 microservices plus une UI. Elle a été conçue comme support pédagogique pour illustrer les cas concrets d'instrumentation OpenTelemetry (HTTP, gRPC, Python, Go, auto-instrumentation, instrumentation manuelle).

## Schéma

```text
UI (React/Vite)
├── /api/users     → users-service       (Python/Flask)
├── /api/products  → products-service    (Python/Flask)
└── /api/billing   → billing-service     (Python/Flask)
                      ├── products-service   (HTTP - validation/décrément stock)
                      ├── users-service      (HTTP - récupération panier/user)
                      └── payment-service    (Python/Flask)
                            └── bank-service (Go/gRPC)
```

## Services et ports

| Service            | Port host | Port interne k8s | Stack                                | Communication                 |
| ------------------ | --------- | ---------------- | ------------------------------------ | ----------------------------- |
| `ui`               | 3000      | 8080             | React 19, Vite, Tailwind             | HTTP (proxy Vite)             |
| `users-service`    | 8001      | 8080             | Flask, SQLite, Gunicorn              | HTTP REST                     |
| `products-service` | 8002      | 8080             | Flask, SQLite, Gunicorn              | HTTP REST                     |
| `payment-service`  | 8003      | 8080             | Flask, SQLite, Gunicorn, gRPC client | HTTP REST + gRPC (sortant)    |
| `billing-service`  | 8004      | 8080             | Flask, SQLite, Gunicorn              | HTTP REST                     |
| `bank-service`     | 50051     | 8080             | Go, gRPC, OTel SDK                   | gRPC                          |
| `otel-collector`   | 4317/4318 | 4317/4318        | OTel Collector Contrib               | OTLP gRPC + OTLP HTTP         |

> En Kubernetes, tous les Services exposent le port **8080** et pointent vers le port natif du conteneur. En Docker Compose, chaque service expose son port natif directement.

## Patterns de communication

- **UI → backends** : HTTP REST via le proxy Vite (routes déclarées dans [ui/vite.config.ts](../ui/vite.config.ts)).
- **billing-service → products / users / payment** : HTTP REST synchrone (orchestration du checkout).
- **payment-service → bank-service** : **gRPC** — contrat dans [proto/transaction.proto](../proto/transaction.proto).

## Responsabilités

| Service            | Rôle métier                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| `users-service`    | Authentification, gestion utilisateurs, panier                                          |
| `products-service` | Catalogue, gestion du stock                                                             |
| `billing-service`  | Orchestration du checkout : validation stock, calcul TTC/shipping, paiement, commandes  |
| `payment-service`  | Traitement paiement, appelle `bank-service` en gRPC                                     |
| `bank-service`     | Simule la banque : latence 100–500 ms, ~10 % de déclin aléatoire                        |

## Structure du code (par service)

Services **Python** (`users`, `products`, `payment`, `billing`) :

```text
app.py      - Handlers Flask (routes, validation, HTTP)
service.py  - Logique métier (aucune dépendance Flask)
db.py       - Couche SQLite (connexion, requêtes, init schéma)
```

Service **Go** (`bank`) :

```text
main.go     - Point d'entrée (serveur gRPC + init OTel)
handler.go  - Handler gRPC (mapping request/response)
service.go  - Logique métier (spans custom)
otel.go     - Init SDK OTel (traces, metrics, logs)
logger.go   - slog avec bridge OTel
```

## Données & persistence

- Chaque service Python utilise **SQLite** (`/data/*.db`) avec un volume Docker dédié.
- Les données de seed sont créées au premier démarrage (produits, 2 utilisateurs).
- `task stack:down` supprime les volumes et repart de zéro.

## Pour aller plus loin

- [04-observability.md](04-observability.md) — comment les signaux OTel circulent dans la stack.
- [05-development.md](05-development.md) — développer et tester un service seul.
