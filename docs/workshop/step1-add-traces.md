# Étape 1 — Instrumentation des traces (`payment-service`)

> Branche : `main`
> Durée estimée : 30 min
> État à l'arrivée : aucun service Python n'est instrumenté. Le `bank-service` (Go) est **déjà instrumenté** par l'animateur — juste le SDK + [`otelgrpc`](https://pkg.go.dev/go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc) côté serveur, export console. C'est ce qui va nous permettre de **voir la propagation de contexte distribuée** Python → Go en action dès cette première étape, sans que tu aies à écrire une ligne de Go.

## Ce que tu vas apprendre

- Installer et configurer le **SDK OpenTelemetry Python** dans un service (`TracerProvider`, `Resource`, `SimpleSpanProcessor`, `ConsoleSpanExporter`).
- Instrumenter un serveur Flask avec [`opentelemetry-instrumentation-flask`](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-flask).
- Instrumenter un **client gRPC** avec [`opentelemetry-instrumentation-grpc`](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-grpc).
- Observer en direct la **propagation de contexte W3C Trace Context** : le `trace_id` produit par `payment-service` se retrouve côté `bank-service` via les métadonnées gRPC.

> Pour cette première étape, on reste simple : les spans sont exportés **sur la console** (stdout du conteneur). Le branchement vers le collecteur viendra plus tard.

## Pourquoi programmatique ?

L'alternative (démo de l'animateur) est l'**auto-instrumentation zero-code** via l'OpenTelemetry Operator en Kubernetes : une annotation, un init-container, zéro ligne de code. Pratique mais opaque — et limitée à Python/Java/Node côté operator.

L'approche **programmatique** consiste à **importer les libs dans ton projet** et à les activer au démarrage. Elle est explicite, déployable n'importe où (Docker, bare-metal, k8s sans operator), disponible dans **tous les langages** instrumentés, et c'est la base pour ajouter plus tard des spans custom, des hooks, des attributs métier.

## Pourquoi `payment-service` pour commencer ?

Parce qu'il est au **milieu de la chaîne** et combine deux modes de communication :

```text
UI → billing → payment → bank (gRPC)
                         └──── déjà instrumenté en Go
                              (traces auto via otelgrpc)
```

En l'instrumentant, on déclenche d'un coup trois choses intéressantes :

1. Un span **serveur HTTP** Flask pour la requête `POST /payments`.
2. Un span **client gRPC** pour l'appel à `bank-service`.
3. Un header `traceparent` ajouté automatiquement dans les métadonnées gRPC → côté `bank`, le propagateur OTel Go le lit et **otelgrpc crée un span enfant** dans la **même** trace.

**Résultat** : une trace distribuée Python → Go visible dès l'exo 1, sans toucher au code de `bank-service`.

## Exercice

### 1. Ajouter les dépendances

Modifier [payment-service/requirements.txt](../../payment-service/requirements.txt) :

```text
flask==3.1.1
flask-cors==5.0.1
gunicorn==23.0.0
grpcio==1.70.0
grpcio-tools==1.70.0
protobuf>=5.28.2,<6.0

opentelemetry-api==1.29.0
opentelemetry-sdk==1.29.0
opentelemetry-instrumentation-flask==0.50b0
opentelemetry-instrumentation-grpc==0.50b0
```

> **À propos des versions** : `opentelemetry-api` et `opentelemetry-sdk` suivent une **version stable** (1.x). Les packages d'instrumentation (`opentelemetry-instrumentation-*`) suivent une **version bêta** (0.x) alignée : `1.29.0` ↔ `0.50b0`. C'est normal et documenté en amont.
>
> Le **`ConsoleSpanExporter`** est fourni par `opentelemetry-sdk` — pas de dépendance supplémentaire à ajouter.

### 2. Créer le module d'initialisation OTel

Nouveau fichier [payment-service/otel.py](../../payment-service/otel.py) :

```python
# SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
# SPDX-License-Identifier: MIT

import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter


def setup_tracing() -> None:
    """Configure the global TracerProvider. Call once at process startup."""
    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "payment-service"),
        "service.version": os.getenv("OTEL_SERVICE_VERSION", "1.0.0"),
    })

    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        SimpleSpanProcessor(ConsoleSpanExporter())
    )
    trace.set_tracer_provider(provider)
```

> **Pourquoi `SimpleSpanProcessor` et pas `BatchSpanProcessor` ?** Pour la console, on veut voir chaque span **dès qu'il se termine**, pas attendre qu'un batch se remplisse. En production avec un export réseau (OTLP), on repassera en `BatchSpanProcessor`.

### 3. Brancher les instrumenteurs dans l'app

Modifier [payment-service/app.py](../../payment-service/app.py) — ajouter les imports et appels **avant** la création de `app` :

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.grpc import GrpcInstrumentorClient

from db import init_db, close_db
from otel import setup_tracing
import service

# 1. Démarrer le SDK AVANT tout
setup_tracing()

# 2. Instrumenter le client gRPC (scope process : wrappe tous les channels sortants)
GrpcInstrumentorClient().instrument()

app = Flask(__name__)

# 3. Instrumenter CETTE instance Flask
FlaskInstrumentor().instrument_app(app)

CORS(app)
app.teardown_appcontext(close_db)
```

Points d'attention :

- **Ordre d'initialisation** : `setup_tracing()` **avant** les `Instrumentor`. Les instrumenteurs utilisent le `TracerProvider` global au moment du patch.
- **`GrpcInstrumentorClient().instrument()`** doit s'exécuter **avant** que `service.py` n'ouvre son `grpc.insecure_channel(...)`. Comme `service.py` crée le channel à chaque appel de `process_payment` (pas à l'import), on est tranquille — mais bon à savoir pour les services qui construiraient un stub au démarrage.
- **`FlaskInstrumentor().instrument_app(app)`** (scope: cette instance) plutôt que `.instrument()` global — bonne pratique pour un service mono-app.

### 4. Nommer le service (optionnel)

Le `ConsoleSpanExporter` n'a besoin d'aucune configuration réseau. Seule variable utile : `OTEL_SERVICE_NAME`, lue par [otel.py](../../payment-service/otel.py) pour peupler l'attribut `service.name`. La valeur par défaut (`payment-service`) suffit.

**En Docker Compose** — dans [docker-compose.yml](../../docker-compose.yml), bloc `payment-service` :

```yaml
payment-service:
  # ...
  environment:
    - BANK_SERVICE_HOST=bank-service:50051   # existant
    - OTEL_SERVICE_NAME=payment-service      # ajouter
```

### 5. Rebuilder et redémarrer

```bash
task build:payment-service
task stack:up
```

### 6. Générer du trafic

Une seule requête suffit pour cette étape — c'est plus facile de lire une trace isolée dans les logs.

```bash
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-42", "amount": 49.90}'
```

Réponse attendue :

- `201 Created` avec un JSON `{ "id": ..., "status": "approved", ... }` si la banque approuve,
- `502 Bad Gateway` avec `{ "error": "bank transaction failed: ..." }` sur les ~10 % de déclins simulés par `bank-service` — c'est un comportement métier attendu, pas un bug.

### 7. Observer les spans côté `payment-service`

```bash
task stack:logs -- payment-service
```

Tu verras **deux** spans (format Python) :

- un **serveur HTTP** `POST /payments` (kind `SpanKind.SERVER`, attributs `http.method`, `http.route`, `http.status_code`),
- un **client gRPC** `/transaction.TransactionService/ProcessTransaction` (kind `SpanKind.CLIENT`, attributs `rpc.system=grpc`, `rpc.service`, `rpc.method`, `rpc.grpc.status_code`) — enfant du span HTTP.

Noter le `trace_id` **partagé** par ces deux spans.

### 8. Observer le span côté `bank-service`

```bash
task stack:logs -- bank-service
```

Tu verras **un** span émis par `otelgrpc` (format Go, rendu différent mais les mêmes champs) :

- `transaction.TransactionService/ProcessTransaction` avec `SpanKind = 2` (SERVER).
- Son `Parent.TraceID` et `Parent.SpanID` correspondent au span CLIENT de `payment`, et **`Parent.Remote = true`** : c'est la preuve tangible que le `traceparent` a traversé le réseau et a été repris côté receveur.

🎉 Première trace distribuée Python → Go, sans avoir touché à `bank-service`.

## Analyse : l'arbre de la trace distribuée

Exemple concret extrait des logs pour **une** requête `POST /payments` :

```text
trace_id = feeac4dfde98315e31228b627bc64425
│
└─ POST /payments                                                    [payment, SERVER]     ← racine
   span_id     = de353c3a2010b18f
   parent_id   = null
   service     = payment-service
   attrs       : http.method, http.route, http.status_code=201
   │
   └─ /transaction.TransactionService/ProcessTransaction             [payment, CLIENT]
      span_id     = 8509696c30710910
      parent_id   = de353c3a2010b18f                                   ← pointe vers POST /payments
      service     = payment-service
      attrs       : rpc.system=grpc, rpc.service, rpc.method
      │
      └─ transaction.TransactionService/ProcessTransaction            [bank, SERVER]
         SpanID      = b584d1c427158f51
         Parent.ID   = 8509696c30710910  (Remote: TRUE)                ← pointe vers le span CLIENT de payment, AU TRAVERS du réseau
         service     = bank-service
         instrumentation : otelgrpc
```

### Les règles de lecture

1. **Un `trace_id` unique** (`feeac4df…`) circule sur les trois spans. C'est l'identifiant de la requête de bout en bout — dans un backend comme Tempo, c'est lui qu'on utilise pour retrouver toute la trace.
2. **`parent_id` / `Parent.SpanID` pointe vers le `span_id` du parent.** Tu peux reconstituer l'arbre à la main depuis les logs.
3. **`Remote: true` (côté Go)** est le marqueur-clé de la propagation cross-process : « mon parent n'est pas dans mon processus, il m'a été transmis par un header entrant. » C'est la preuve que W3C Trace Context a fonctionné.
4. **`SpanKind`** indique le rôle dans l'échange :
   - `SERVER` : je reçois une requête (Flask HTTP ou gRPC server).
   - `CLIENT` : j'émets une requête (gRPC client).
   - `INTERNAL` : span purement local (logique métier, à la main — on en verra à l'exo 5).

### Lecture des timestamps

```text
payment  POST /payments              [16:07:29.751908 → 16:07:30.109760]
payment  gRPC CLIENT                 [16:07:29.775531 → 16:07:30.101654]  ⊂ parent
bank     gRPC SERVER                 [16:07:29.778634 → 16:07:30.100300]  ⊂ parent (+ ~3 ms réseau)
```

Chaque enfant commence **après** son parent et finit **avant**. Le décalage `payment CLIENT → bank SERVER` (~3 ms) correspond au temps de traversée réseau + sérialisation gRPC — c'est exactement ce qu'on cherche à mesurer en tracing distribué.

## Preuve par l'absurde : sans l'instrumentation gRPC côté client

Pour bien comprendre ce que `GrpcInstrumentorClient` apporte, commente cette ligne dans [payment-service/app.py](../../payment-service/app.py) et rebuild :

```python
# GrpcInstrumentorClient().instrument()
```

Rebuild (`task build:payment-service && task stack:up`) et relance le curl.

**Côté payment-service** — plus qu'**un seul span**, le Flask :

```text
name:      POST /payments
trace_id:  c74ac719d07c867bf95b72e9c7c9f656
span_id:   5eb5bfbd6bab2cbb
parent_id: null
```

Pas de span CLIENT gRPC : l'appel à `bank-service` se fait toujours, mais sans instrumentation, le channel est invisible côté traces.

**Côté bank-service** — toujours un span, mais :

```text
SERVER    transaction.TransactionService/ProcessTransaction
  TraceID:        c0837f7667fa9c2f096aafc357b7fef9        ← DIFFÉRENT de payment !
  Parent.TraceID: 00000000000000000000000000000000      ← tous zéros
  Parent.SpanID:  0000000000000000                       ← tous zéros
  Parent.Remote:  true                                   ← tentative de lecture du header, mais rien à lire
```

Analyse :

- Les `trace_id` de `payment` (`c74a…`) et de `bank` (`c083…`) **diffèrent** → ce sont **deux traces séparées**. Dans Grafana/Tempo, tu verrais deux petits arbres isolés au lieu d'un arbre complet.
- Côté bank, `Parent.Remote = true` mais les IDs sont tous à zéro : le propagateur OTel du serveur gRPC a cherché un `traceparent` dans les métadonnées entrantes, **n'a rien trouvé**, et a démarré une trace vierge.
- **Moralité** : la propagation n'est pas automatique. Elle dépend du fait que **le client** injecte le header — c'est précisément le rôle de `opentelemetry-instrumentation-grpc` côté payment.

Réactive la ligne avant de passer à la suite :

```python
GrpcInstrumentorClient().instrument()
```

puis `task build:payment-service && task stack:up`.

## Critères de validation

- [ ] `payment-service` démarre sans erreur avec les nouvelles dépendances.
- [ ] Un `POST /payments` produit **deux spans** dans la console de `payment-service` : un span serveur HTTP et un span client gRPC enfant.
- [ ] Les deux spans Python partagent le même `trace_id`.
- [ ] Dans la console de `bank-service`, un span gRPC SERVER apparaît avec le **même `trace_id`** et `Parent.Remote = true`.

## Pour aller plus loin

- **Hooks Flask** : `FlaskInstrumentor().instrument_app(app, request_hook=..., response_hook=...)` pour ajouter des attributs métier (`user_id`, `payment.amount`…) sur les spans.
- **Exclusion d'URLs** : `OTEL_PYTHON_FLASK_EXCLUDED_URLS=health` pour ne pas tracer le endpoint de santé.
- **Piège gunicorn + preload** : si `preload_app=True` est activé, initialiser le SDK dans un `post_fork` hook (sinon le span processor ne survit pas au fork).
- **Le header `traceparent`** suit le format [W3C Trace Context](https://www.w3.org/TR/trace-context/). C'est ce qui permet l'interopérabilité entre Python (OTel SDK) et Go (OTel SDK) — et n'importe quel autre langage instrumenté.
- **Et après la console ?** Le `ConsoleSpanExporter` est parfait pour débugger mais inexploitable en prod. Dans une étape suivante, on le remplacera par un `OTLPSpanExporter` qui envoie les spans au collecteur, qui les forwarde à Tempo / Grafana Cloud — et on pourra visualiser la trace distribuée dans un seul onglet Grafana.

## Étape suivante

Une fois l'exo validé, direction [step2-add-metrics.md](step2-add-metrics.md).

Sur la branche `step-2-metrics`, **tous** les services Python sont instrumentés pour les traces selon le même pattern (préparé par l'animateur) — tu y trouveras l'énoncé de l'exercice 2 sur les **métriques**.
