# Étape 3 — Logs : corrélation (payment) et bridge OTel (products)

> Branche : `step-3-logs`
> Durée estimée : 30 min
> État à l'arrivée : tous les services Python sont instrumentés pour les **traces** (exo 1) et les **métriques** (exo 2), tout sort sur la **console**. Le `bank-service` (Go) émet aussi les trois signaux.

## Préparation : passer sur la branche `step-3-logs`

Tu arrives de l'exo 2 avec des modifications locales sur `step-2-metrics`. On les **écarte** pour récupérer l'état propre de `step-3-logs` (solution de référence de l'exo 2 + point de départ de l'exo 3).

```bash
# 1. Annule toutes les modifications locales sur les fichiers suivis
git reset --hard

# 2. Supprime les fichiers non suivis
git clean -fd

# 3. Bascule sur la branche de l'exo 3
git checkout step-3-logs
```

> ⚠️ Ces commandes **détruisent** ton travail local de l'exo 2. Si tu veux conserver ta solution, fais d'abord un `git stash` ou un commit sur une branche perso avant la réinitialisation.

## Ce que tu vas apprendre

- Les **trois approches** possibles pour gérer les logs avec OpenTelemetry, et leurs compromis.
- Mettre en place la **corrélation seule** sur `payment-service` avec [`opentelemetry-instrumentation-logging`](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-logging) — pas de provider, juste un formatter enrichi.
- Mettre en place le **bridge OTel complet** sur `products-service` avec `LoggerProvider` + `LoggingHandler` + `ConsoleLogExporter` — les logs deviennent une vraie télémétrie OTel.
- Comparer côte à côte les deux approches pour savoir **laquelle choisir en pratique**.

## Les trois approches possibles

| Approche | Ce qui change | Ce qui ne change pas |
| --- | --- | --- |
| **Corrélation seule** (partie A — payment) | Le formatter Python ajoute `trace_id`/`span_id` à chaque record | Les logs continuent de sortir via stdout/stderr, pipeline Python standard |
| **Bridge OTel seul** | Un `LoggingHandler` envoie les records vers un `LoggerProvider` OTel | Pas d'info de trace dans les records (sauf si on les corrèle aussi) |
| **Bridge + corrélation** (partie B — products) | Les deux : records enrichis **et** exportés via OTLP | — |

La **corrélation seule** est souvent suffisante en pratique : tu gardes ton pipeline de logs existant (fichiers, journald, stdout scrapé par un agent), et tu rajoutes juste la possibilité de retrouver une trace depuis un log. Le **bridge complet** est plus intrusif mais unifie ta télémétrie dans une seule pipeline OTel.

On va faire **les deux**, sur deux services différents, pour voir les deux formats cohabiter dans la stack.

---

## Partie A — Corrélation seule sur `payment-service`

> 📌 **Pas de `LoggerProvider` ici**. Contrairement aux exos 1 (traces → `TracerProvider`) et 2 (métriques → `MeterProvider`), on **ne touche pas à [payment-service/otel.py](../../payment-service/otel.py)**. La corrélation seule n'a besoin d'aucun provider : `LoggingInstrumentor` patche directement la `LogRecord` factory de Python pour peupler `trace_id`/`span_id`. Zéro pipeline d'export, zéro provider à gérer, zéro shutdown à orchestrer.

### 1. Ajouter la dépendance

Modifier [payment-service/requirements.txt](../../payment-service/requirements.txt) — ajouter **une** ligne :

```text
opentelemetry-instrumentation-logging==0.50b0
```

### 2. Brancher `LoggingInstrumentor`

Modifier [payment-service/app.py](../../payment-service/app.py) :

```python
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.grpc import GrpcInstrumentorClient
from opentelemetry.instrumentation.logging import LoggingInstrumentor   # ← ajouter
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor

# ...

setup_tracing()
setup_metrics()

GrpcInstrumentorClient().instrument()
SQLite3Instrumentor().instrument()
LoggingInstrumentor().instrument(set_logging_format=True)   # ← ajouter
```

Ce que fait `LoggingInstrumentor` :

- Avec `set_logging_format=True`, il appelle `logging.basicConfig(...)` avec un format qui inclut `otelTraceID`, `otelSpanID`, `otelServiceName`.
- Il patche le `LogRecord` factory pour peupler ces champs à partir du contexte OTel courant au moment où le record est créé.

Résultat : tout log émis via `logging.info(...)`, `app.logger.info(...)` ou `logger.info(...)` contient désormais les IDs de trace.

### 3. Ajouter un log applicatif pour voir l'effet

Le code actuel de `payment-service` n'utilise pas `logging` explicitement — on ne verrait donc que les logs internes de Flask/gunicorn. Ajoutons un log métier dans le handler pour rendre la démo claire.

Modifier [payment-service/app.py](../../payment-service/app.py) :

```python
import logging
# ... imports existants

logger = logging.getLogger("payment")

# ... setup ...

@app.route("/payments", methods=["POST"])
def create_payment():
    data = request.get_json()
    if not data or not data.get("user_id") or data.get("amount") is None:
        return jsonify({"error": "user_id and amount are required"}), 400

    logger.info(
        "payment_requested",
        extra={"user_id": data["user_id"], "amount": data["amount"]},
    )

    payment, error = service.process_payment(data["user_id"], data["amount"])
    if error:
        logger.warning("payment_failed", extra={"reason": error})
        return jsonify({"error": error, "payment_id": None}), 502

    logger.info("payment_approved", extra={"payment_id": payment.get("id")})
    return jsonify(payment), 201
```

### 4. Rebuilder

```bash
task build:payment-service
task stack:up
```

### 5. Générer une requête

```bash
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-42", "amount": 49.90}'
```

### 6. Observer

```bash
task stack:logs -- payment-service
```

Tu vas voir une **ligne de log** au format Python, enrichie des champs OTel :

```text
2026-04-19 12:34:56,789 INFO [payment] [app.py:38] [trace_id=feeac4dfde98315e31228b627bc64425 span_id=3a1b2c4d5e6f7890 resource.service.name=payment-service trace_sampled=True] - payment_requested
```

Le `trace_id` de cette ligne correspond au `trace_id` du span `POST /payments` émis juste après.

---

## Partie B — Bridge OTel + corrélation sur `products-service`

Maintenant, le vrai bridge. On va envoyer les logs Python **dans un `LoggerProvider`** OTel qui les exporte au format OTel vers la console — en parallèle du pipeline Python qui continue d'écrire sur stdout.

### 1. Ajouter les dépendances

Modifier [products-service/requirements.txt](../../products-service/requirements.txt) :

```text
opentelemetry-instrumentation-logging==0.50b0
```

> Le `ConsoleLogExporter` et le `LoggerProvider` sont dans `opentelemetry-sdk` déjà présent — pas de nouveau paquet.

### 2. Ajouter `setup_logging()` à `otel.py`

Modifier [products-service/otel.py](../../products-service/otel.py) — enrichir la ligne d'import OTel qui existe déjà et ajouter les nouveaux imports SDK logs :

```python
import logging

from opentelemetry import metrics, trace, _logs          # ← ajouter _logs
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor, ConsoleLogExporter
# ... le reste des imports inchangés
```

> ⚠️ **Pourquoi `_logs` avec un underscore, et pas `logs` ?**
>
> L'API des logs dans `opentelemetry-api` est **encore marquée expérimentale** par les mainteneurs. L'underscore est le marqueur idiomatique Python pour « API non publique — peut changer sans garantie de compatibilité ».
>
> Concrètement :
>
> - `from opentelemetry import trace` → OK, API **stable** depuis longtemps.
> - `from opentelemetry import metrics` → OK, API **stable** (depuis fin 2022).
> - `from opentelemetry import logs` → **échec à l'import** : le module s'appelle `_logs`, pas `logs`. Tant que l'API logs n'est pas stabilisée, l'import stable n'existera pas.
> - `from opentelemetry import _logs` → OK, c'est le chemin actuel.
>
> Même logique côté SDK : `opentelemetry.sdk.trace` et `opentelemetry.sdk.metrics` sont publics, `opentelemetry.sdk._logs` est préfixé. Le jour où l'API est stabilisée (comme l'a été metrics), les imports perdront leur underscore et la migration sera un simple renommage.

Puis, en bas du fichier, **une nouvelle fonction** à côté de `setup_tracing()` et `setup_metrics()` :

```python
def setup_logging() -> None:
    """Configure the global LoggerProvider and bridge stdlib logging to it."""
    provider = LoggerProvider(resource=_resource())
    provider.add_log_record_processor(
        BatchLogRecordProcessor(ConsoleLogExporter())
    )
    _logs.set_logger_provider(provider)

    # Branche stdlib Python logging → OTel LoggerProvider
    handler = LoggingHandler(level=logging.INFO, logger_provider=provider)
    logging.getLogger().addHandler(handler)
```

Note le `_logs.set_logger_provider(provider)` — même pattern que `trace.set_tracer_provider(...)` et `metrics.set_meter_provider(...)` vus aux exos 1 et 2, avec juste le préfixe underscore.

Trois pièces à noter :

- **`LoggerProvider(resource=_resource())`** : même `Resource` que les traces et métriques. Un log aura donc le bon `service.name` quand il arrive dans le backend.
- **`BatchLogRecordProcessor`** : équivalent du `BatchSpanProcessor` pour les logs — bufferise et exporte par paquet.
- **`logging.getLogger().addHandler(handler)`** : on **ajoute** un handler au root logger. Les handlers existants (ceux qui écrivent sur stdout) ne sont pas remplacés. Résultat : chaque log est émis **deux fois**, une en format texte Python (console classique), une en format OTel LogRecord (console via OTel).

### 3. Brancher le tout dans `app.py`

Modifier [products-service/app.py](../../products-service/app.py) :

```python
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor   # ← ajouter
from opentelemetry.instrumentation.sqlite3 import SQLite3Instrumentor

from db import init_db, close_db
from otel import setup_tracing, setup_metrics, setup_logging   # ← setup_logging
import service

# ...

setup_tracing()
setup_metrics()
setup_logging()                                                # ← ajouter

SQLite3Instrumentor().instrument()
LoggingInstrumentor().instrument(set_logging_format=True)      # ← corrélation aussi
```

### 4. Rebuilder products

```bash
task build:products-service
task stack:up
```

### 5. Générer du trafic sur products

`products-service` a déjà `logger.info("products_listed", ...)` et consorts dans ses handlers existants, rien à ajouter :

```bash
curl http://localhost:8002/products
```

### 6. Observer la double sortie

```bash
task stack:logs -- products-service
```

Tu vas voir **deux formats** arriver pour chaque log :

1. La ligne Python classique avec corrélation (comme côté payment) :

   ```text
   2026-04-19 12:35:40,123 INFO [products] [app.py:33] [trace_id=9b2e... span_id=7a1c... resource.service.name=products-service trace_sampled=True] - products_listed
   ```

2. Le **LogRecord OTel** (format JSON-ish) exporté par le `ConsoleLogExporter` :

   ```text
   {
       "body": "products_listed",
       "severity_number": "<SeverityNumber.INFO: 9>",
       "severity_text": "INFO",
       "attributes": {
           "status_filter": "Active",
           "result_count": 42
       },
       "timestamp": "2026-04-19T12:35:40.123456Z",
       "trace_id": "0x9b2e...",
       "span_id": "0x7a1c...",
       "trace_flags": 1,
       "resource": {
           "attributes": {
               "service.name": "products-service",
               "service.version": "1.0.0"
           }
       }
   }
   ```

Le second format est une **vraie télémétrie structurée** : `body`, `severity_number`, `attributes` (y compris les `extra={...}` passés au logger), `timestamp`, `trace_id`/`span_id`, et `resource` — tout ce qu'il faut pour un backend d'observabilité moderne.

---

## Analyse comparative

| Aspect | Corrélation seule (payment) | Bridge + corrélation (products) |
| --- | --- | --- |
| `otel.py` | **Intact** | Nouveau `setup_logging()` + imports logs |
| `requirements.txt` | +1 paquet | +1 paquet (même paquet) |
| Format sortie | Ligne texte Python enrichie | Ligne texte **ET** LogRecord JSON |
| `resource.service.name` | Dans la ligne texte (via formatter) | Dans la ligne texte **et** dans le LogRecord (via `Resource`) |
| Attributs structurés (`extra={...}`) | Non (perdus dans le message texte) | Oui (préservés dans `attributes`) |
| Export distant possible | Non (tu scrapes le stdout avec ton agent) | Oui (remplace `ConsoleLogExporter` par `OTLPLogExporter`) |
| Coût de mise en place | 2 lignes | ~15 lignes |
| Empreinte runtime | Quasi nulle | Un thread d'export + un buffer |

**Quand choisir quoi, en vrai :**

- **Corrélation seule** : infra logs déjà en place (ELK, Loki via Promtail, Splunk…), tu ne veux rien changer à la collecte. Tu gagnes juste la pierre angulaire : le `trace_id` dans chaque log, pour faire du **trace-to-log** en un clic depuis Grafana/Tempo.
- **Bridge complet** : tu démarres sur un projet vert, ou tu veux unifier toute ta télémétrie dans une seule pipeline OTLP. Avantage bonus : les `extra={...}` deviennent des **attributs structurés**, indexables côté backend.
- **Hybride (ce que fait notre stack maintenant)** : services "legacy" en corrélation seule, services "neufs" en bridge complet. Migration progressive.

## Critères de validation

- [ ] **payment** : un `POST /payments` produit un log `payment_requested` au format Python avec `trace_id=` / `span_id=` remplis.
- [ ] **payment** : le `trace_id` du log == le `trace_id` du span HTTP correspondant.
- [ ] **products** : un `GET /products` produit **deux** sorties par log : une ligne Python ET un LogRecord JSON.
- [ ] **products** : le LogRecord JSON contient `body`, `severity_text`, `resource.attributes.service.name=products-service`, et un `trace_id`/`span_id` non nul.
- [ ] **products** : les `extra={status_filter: ..., result_count: ...}` sont visibles dans les `attributes` du LogRecord.

## Pour aller plus loin

- **Format custom** : `LoggingInstrumentor().instrument(set_logging_format=False)` si tu veux garder ton propre format. Dans ce cas, tu ajoutes toi-même `%(otelTraceID)s` / `%(otelSpanID)s` dans ton format string.
- **Corrélation inter-services** : comme les `trace_id` sont propagés en amont par les instrumenteurs (gRPC, requests, Flask), un log émis dans `bank-service` porte déjà **le même** `trace_id` que le log dans `payment-service` pour une requête donnée. Dans un backend comme Grafana Loki, on peut faire `{trace_id="feeac4..."}` pour sortir tous les logs de la trace, **cross-service**.
- **Pourquoi `_logs` et pas `logs` ?** L'API stable pour les logs dans `opentelemetry-api` est encore estampillée "expérimentale" dans certaines versions : d'où les imports `opentelemetry._logs` (underscore) et `opentelemetry.sdk._logs`. C'est le signal que l'API peut évoluer.
- **`BatchLogRecordProcessor` vs `SimpleLogRecordProcessor`** : on a choisi le batch pour cohérence avec la pratique (moins de pression I/O). Pour une console pédagogique, `SimpleLogRecordProcessor` donne un retour immédiat — à essayer si la latence de 1–2 s te gêne.

## Étape suivante

Une fois les deux parties validées, direction [step4-add-collector.md](step4-add-collector.md).

Sur la branche `step-4-collector` :

- `payment-service` garde la corrélation seule.
- `products-service` garde le bridge complet.
- `users-service` a aussi reçu le bridge complet (fait par l'animateur).
- L'exercice 4 portera sur la mise en place du **collecteur OpenTelemetry** pour enfin sortir les trois signaux de la console et les envoyer vers Grafana.
