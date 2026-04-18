# Observabilité

Vue d'ensemble de la stack OpenTelemetry utilisée par l'atelier : où naissent les signaux, par où ils transitent, où ils sont stockés et visualisés.

## Pipeline des signaux

```text
┌────────────────────────┐       OTLP         ┌────────────────┐       OTLP HTTP
│  Services applicatifs  │ ─────────────────▶ │ OTel Collector │ ────────────────▶  Grafana Cloud
│  (traces, metrics,     │                    │                │                    (ou backends locaux :
│   logs)                │                    │                │                     Tempo, VictoriaMetrics)
└────────────────────────┘                    └────────────────┘
```

## Instrumentation par service

### Services Python (`users`, `products`, `payment`, `billing`)

**Auto-instrumentation zero-code** par l'OpenTelemetry Operator en Kubernetes. Dans les `ResourceSet` de [manifests/rs-services.yaml](../manifests/rs-services.yaml), chaque Deployment porte l'annotation :

```yaml
annotations:
  instrumentation.opentelemetry.io/inject-python: "python-instrumentation"
```

L'opérateur injecte un init-container qui dépose le SDK Python + les librairies d'auto-instrumentation (Flask, requests, SQLite3, gRPC client…) dans le conteneur cible.

### Service Go (`bank-service`)

**Instrumentation manuelle** avec le SDK OTel Go — voir [bank-service/otel.go](../bank-service/otel.go). Les spans custom vivent dans [bank-service/service.go](../bank-service/service.go). Le serveur gRPC utilise l'intercepteur `otelgrpc`.

## Configuration du Collecteur

Deux chemins possibles selon le mode d'exécution :

### Docker Compose

Le collecteur utilise [configs/otelcol-config.yaml](../configs/otelcol-config.yaml). Pipeline actuel :

- **Receivers** : OTLP gRPC (`:4317`) + OTLP HTTP (`:4318`).
- **Processors** : `memory_limiter` → `batch`.
- **Exporters** : `debug` (stdout) + `otlphttp/grafana_cloud` (authentifié en Basic Auth via les env vars `GRAFANA_CLOUD_*`).

### Kubernetes (k3d)

Le collecteur est déployé via le `ResourceSet` [manifests/rs-collector.yaml](../manifests/rs-collector.yaml). Les placeholders `__GRAFANA_CLOUD_*__` sont substitués par `task cluster:apply` (voir [03-deployment-k3d.md](03-deployment-k3d.md)).

## Ce qui circule sur chaque signal

| Signal    | Source                                                  | Backend de stockage                     |
| --------- | ------------------------------------------------------- | --------------------------------------- |
| Traces    | Flask auto-instr. + Go `otelgrpc` + spans custom (bank) | Tempo (k8s) / Grafana Cloud             |
| Metrics   | Flask `opentelemetry-instrumentation` + Go metric SDK   | VictoriaMetrics (k8s) / Grafana Cloud   |
| Logs      | Python logging bridge + Go `slog` bridge                | Grafana Cloud                           |

> L'état exact des signaux exportés **dépend de la branche du workshop** : chaque étape ajoute progressivement un signal ou une cible. Voir [workshop/README.md](workshop/README.md).

## Voir les données

- **En Docker Compose** : le collecteur est en `verbosity: detailed` sur l'exporter `debug`. Tail les logs :

  ```bash
  task stack:logs
  ```

- **En Kubernetes** : Grafana est déployé en local. Voir [03-deployment-k3d.md](03-deployment-k3d.md) étape 6.

- **Grafana Cloud** : dashboards Explore → Traces / Metrics / Logs avec le filtre `service.name`.

## Référence

- [`OpenTelemetry Operator`](https://github.com/open-telemetry/opentelemetry-operator)
- [Spec Auto-instrumentation Python](https://opentelemetry.io/docs/zero-code/python/)
- [OTel Collector Contrib](https://github.com/open-telemetry/opentelemetry-collector-contrib)
