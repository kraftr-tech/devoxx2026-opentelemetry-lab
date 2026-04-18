# Étape 2 — Auto-instrumentation des métriques (`payment-service`)

> Branche : `step-2-metrics`
> Durée estimée : 15 min
> État à l'arrivée : tous les services Python sont instrumentés pour les **traces** (solution de l'exo 1), l'export est toujours sur la **console**. Le `bank-service` (Go) est également déjà instrumenté pour les trois signaux.

## Préparation : passer sur la branche `step-2-metrics`

Tu arrives de l'exo 1 avec des modifications locales sur `main` (les fichiers que tu as édités). On va les **écarter** pour récupérer l'état propre de la branche `step-2-metrics`, qui contient la solution de référence de l'exo 1 et sert de point de départ pour l'exo 2.

```bash
# 1. Annule toutes les modifications locales sur les fichiers suivis
git reset --hard

# 2. Supprime les fichiers non suivis (otel.py, etc. créés pendant l'exo 1)
git clean -fd

# 3. Bascule sur la branche de l'exo 2
git checkout step-2-metrics
```

> ⚠️ Ces commandes **détruisent** ton travail local de l'exo 1. Si tu veux conserver ta solution, fais d'abord un `git stash` ou un commit sur une branche perso avant la réinitialisation.

## Ce que tu vas apprendre

- Configurer un **`MeterProvider`** à côté du `TracerProvider` existant (`Resource`, `PeriodicExportingMetricReader`, `ConsoleMetricExporter`).
- Découvrir que les instrumenteurs déjà en place (`FlaskInstrumentor`, `GrpcInstrumentorClient`) produisent des **métriques gratuites** dès qu'un `MeterProvider` est disponible — sans toucher au code applicatif.
- Lire le format d'export d'une métrique (data points, temporality, attributes) dans la console.

> On reste sur l'export **console**. Le branchement réseau vers le collecteur viendra à l'étape 4.

## Pourquoi c'est presque gratuit

Les packages `opentelemetry-instrumentation-*` couvrent **deux signaux** : traces et métriques. À l'étape 1, seul le `TracerProvider` était configuré — les instrumenteurs ont produit des spans, mais les métriques étaient droppées silencieusement (pas de `MeterProvider` global).

En ajoutant simplement un `MeterProvider`, sans rien changer d'autre, on récupère d'un coup :

- `http.server.active_requests`, `http.server.duration`, `http.server.request.size`, `http.server.response.size` (Flask),
- `rpc.client.duration`, `rpc.client.request.size`, `rpc.client.response.size` (client gRPC).

C'est la démonstration vivante qu'une API d'instrumentation bien pensée **sépare producteurs et consommateurs** : les libs produisent dès qu'un consommateur (provider) est là.

## Exercice

### 1. Enrichir `otel.py` avec `setup_metrics()`

Modifier [payment-service/otel.py](../../payment-service/otel.py). On va :

- extraire la construction du `Resource` dans un helper partagé (même `service.name` pour tous les signaux),
- ajouter une fonction `setup_metrics()` symétrique à `setup_tracing()`.

```python
# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

from opentelemetry import metrics, trace
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor


def _resource() -> Resource:
    """Shared resource for all signals — same service.name everywhere."""
    return Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "payment-service"),
        "service.version": os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
    })


def setup_tracing() -> None:
    """Configure the global TracerProvider. Call once at process startup."""
    provider = TracerProvider(resource=_resource())
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)


def setup_metrics() -> None:
    """Configure the global MeterProvider. Call once at process startup."""
    reader = PeriodicExportingMetricReader(
        ConsoleMetricExporter(),
        export_interval_millis=10_000,  # 10 s, pour voir les métriques rapidement
    )
    provider = MeterProvider(
        resource=_resource(),
        metric_readers=[reader],
    )
    metrics.set_meter_provider(provider)
```

Points d'attention :

- **`PeriodicExportingMetricReader`** n'est pas équivalent à `SimpleSpanProcessor` : les métriques sont **agrégées** sur une fenêtre et exportées en batch. Ici on a réglé la fenêtre à **10 s** pour une lecture rapide pendant l'atelier. En prod, on utilise plutôt 30–60 s.
- **Un seul `Resource` pour les deux signaux** : c'est ce qui permet de corréler `service.name` entre traces et métriques côté backend.

### 2. Appeler `setup_metrics()` dans `app.py`

Modifier [payment-service/app.py](../../payment-service/app.py) — une seule ligne à ajouter :

```python
from otel import setup_tracing, setup_metrics   # ← import mis à jour

# 1. Démarrer le SDK AVANT tout
setup_tracing()
setup_metrics()                                  # ← nouveau

# 2. Instrumenter le client gRPC
GrpcInstrumentorClient().instrument()

# ... le reste inchangé
```

> **Ordre** : `setup_metrics()` **avant** `GrpcInstrumentorClient().instrument()` et `FlaskInstrumentor().instrument_app(app)`. Les instrumenteurs capturent le `MeterProvider` global au moment où ils patchent — s'il n'existe pas encore, ils sortiront sans métriques.

### 3. Rebuilder et redémarrer

```bash
task build:payment-service
task stack:up
```

### 4. Générer du trafic

Plusieurs requêtes (car les métriques sont exportées toutes les 10 s — une seule requête aura du mal à être visible avant la fenêtre d'export) :

```bash
for i in {1..10}; do
  curl -s -X POST http://localhost:8003/payments \
    -H "Content-Type: application/json" \
    -d '{"user_id": "user-42", "amount": 49.90}' > /dev/null
  sleep 1
done
```

### 5. Observer les métriques dans les logs

```bash
task stack:logs -- payment-service
```

Tu vas voir **deux types** de sortie alterner :

- les **spans** imprimés à chaque requête (ce qu'on avait à l'exo 1),
- toutes les 10 s, un gros bloc **métriques** avec `resource_metrics` / `scope_metrics` / `metrics`.

Un exemple (tronqué) :

```json
{
    "resource_metrics": [
        {
            "resource": {
                "attributes": {
                    "service.name": "payment-service",
                    "service.version": "1.0.0"
                }
            },
            "scope_metrics": [
                {
                    "scope": { "name": "opentelemetry.instrumentation.flask" },
                    "metrics": [
                        {
                            "name": "http.server.active_requests",
                            "unit": "{request}",
                            "data": { "data_points": [...] }
                        },
                        {
                            "name": "http.server.duration",
                            "unit": "ms",
                            "data": {
                                "data_points": [{
                                    "attributes": { "http.method": "POST", "http.status_code": 201, ... },
                                    "count": 9,
                                    "sum": 234.7,
                                    "bucket_counts": [...]
                                }]
                            }
                        }
                    ]
                },
                {
                    "scope": { "name": "opentelemetry.instrumentation.grpc" },
                    "metrics": [
                        {
                            "name": "rpc.client.duration",
                            "unit": "ms",
                            "data": { "data_points": [...] }
                        }
                    ]
                }
            ]
        }
    ]
}
```

## Analyse : ce qu'on voit

Quatre observations clés :

1. **Les métriques ont un `resource` identique aux spans** : `service.name=payment-service`. C'est ce qui permet à Grafana (plus tard) de lier vues traces et vues métriques pour le même service.
2. **Deux `scope_metrics` distincts** : `instrumentation.flask` et `instrumentation.grpc`. Chaque lib d'instrumentation est son propre producteur, identifié par son nom. On peut filtrer par scope côté backend.
3. **Les histogrammes (`http.server.duration`, `rpc.client.duration`) exposent `count`, `sum`, `bucket_counts`** : ce n'est pas la valeur brute de chaque requête qui est exportée, c'est déjà **pré-agrégé** côté SDK. D'où l'intérêt d'une fenêtre : trop courte = export bruyant ; trop longue = latence de visualisation.
4. **Les attributs sur les data points** (`http.method`, `http.route`, `http.status_code`, `rpc.method`…) sont automatiquement posés par les instrumenteurs, sans rien écrire dans le code applicatif.

## Critères de validation

- [ ] `payment-service` démarre sans erreur et émet toujours ses spans (on ne casse pas l'exo 1).
- [ ] Après ~10 s de trafic, un bloc `resource_metrics` apparaît dans les logs.
- [ ] Il contient **au moins deux scopes** : `opentelemetry.instrumentation.flask` **et** `opentelemetry.instrumentation.grpc`.
- [ ] La métrique `http.server.duration` a un `count` cohérent avec le nombre de requêtes envoyées.

## Pour aller plus loin

- **Views** : `opentelemetry.sdk.metrics.view.View` permet de renommer, re-bucketiser (ex : ajuster les buckets d'un histogramme à ton SLO), filtrer les attributs pour limiter la cardinalité, ou dropper une métrique. C'est souvent ce qui se joue en prod.
- **Intervalle d'export** : en production avec un export réseau, un intervalle de 30–60 s est la norme. Pour la console pédagogique, 10 s est plus vivant.
- **Métriques custom** : on aurait pu, en plus, créer un `Counter payments_processed_total{status=approved|declined}` pour mesurer notre métier, pas juste la plomberie HTTP/gRPC. C'est ce qu'on fera à l'exo 5 (instrumentation custom).
- **Temporality** : les histogrammes peuvent être `DELTA` (delta depuis le dernier export) ou `CUMULATIVE` (somme depuis le début). Par défaut Python SDK utilise `CUMULATIVE`. Prometheus veut du `CUMULATIVE` ; OTLP natif préfère `DELTA`. À configurer via le reader si besoin.

## Étape suivante

Une fois l'exo validé, direction [step3-add-logs.md](step3-add-logs.md).

Sur la branche `step-3-logs`, **tous** les services Python ont également leurs métriques (le même pattern a été appliqué par l'animateur) — tu y trouveras l'énoncé de l'exercice 3 sur les **logs**.
