# Opentelemetry Hands-on lab — Devoxx FR 2026

[![Code: MIT](https://img.shields.io/badge/Code-MIT-blue.svg)](LICENSE)
[![Docs: CC BY-NC-ND 4.0](https://img.shields.io/badge/Docs-CC_BY--NC--ND_4.0-lightgrey.svg)](docs/LICENSE)

© 2026 Cédric Moulard / Kraftr

Atelier pratique d'instrumentation **OpenTelemetry** autour d'**Atelier**, une application e-commerce composée de 6 microservices (Python/Flask + Go/gRPC + React).

```text
UI → users · products · billing → payment → bank (gRPC)
```

## Démarrer en 30 s

```bash
task stack:up
```

App sur <http://localhost:3000> — compte client : `john.doe@kraftr.tech` / `client123`.

## Suivre l'atelier

➡️ **[docs/workshop/README.md](docs/workshop/README.md)** — 6 étapes (une par branche git), de l'auto-instrumentation zero-code à l'instrumentation custom.

## Documentation complète

| | |
| --- | --- |
| [Démarrage](docs/01-getting-started.md) | Docker Compose, comptes de test |
| [Architecture](docs/02-architecture.md) | Services, ports, patterns de communication |
| [Déploiement k3d](docs/03-deployment-k3d.md) | Kubernetes local + Grafana Cloud |
| [Observabilité](docs/04-observability.md) | Collecteur OTel, signaux, export |
| [Développement](docs/05-development.md) | Taskfile, layout du code |
| [Troubleshooting](docs/06-troubleshooting.md) | Erreurs fréquentes |

Index complet : [docs/README.md](docs/README.md).

## Licences

Ce dépôt applique un **double régime** de licence :

- **Code source** (services, UI, manifests, scripts…) — [MIT](LICENSE).
  Tu peux le réutiliser, le modifier, l'intégrer dans tes projets (y compris commerciaux), à la seule condition de conserver la notice de copyright.

- **Contenu pédagogique** du workshop (`docs/`, exercices, schémas) —
  [Creative Commons BY-NC-ND 4.0](docs/LICENSE).
  **Non-commercial** et **sans dérivés** : tu peux le partager tel quel pour apprendre ou former, mais pas le remixer ni l'utiliser pour une formation payante sans accord.

Pour un usage commercial du matériel pédagogique, contacte-moi.

Détails : [NOTICE](NOTICE).
