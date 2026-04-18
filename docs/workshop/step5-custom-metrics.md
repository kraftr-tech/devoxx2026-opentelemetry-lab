# Étape 5 — Instrumentation custom : spans métier et métriques applicatives

> Branche : `step-5-custom-metrics`
> Durée estimée : 35 min
> État à l'arrivée : tous les trois signaux (traces, métriques, logs) sont maintenant en **auto-instrumentation** et sortent via le collecteur vers Grafana Cloud, tagués par étudiant. Cependant, la télémétrie actuelle est purement **technique** : elle décrit le protocole (HTTP, gRPC), la structure (serveurs, clients), mais pas le **métier**. On va enrichir ça.

## Préparation : passer sur la branche `step-5-custom-metrics`

Tu arrives de l'exo 4 avec les trois signaux qui transitent vers Grafana Cloud. On les **écarte** pour récupérer l'état propre de `step-5-custom-metrics` (solution de référence de l'exo 4 + point de départ de l'exo 5).

```bash
# 1. Annule toutes les modifications locales sur les fichiers suivis
git reset --hard

# 2. Supprime les fichiers non suivis
git clean -fd

# 3. Bascule sur la branche de l'exo 5
git checkout step-5-custom-metrics
```

> ⚠️ Ces commandes **détruisent** ton travail local de l'exo 4. Si tu veux conserver ta solution, fais d'abord un `git stash` ou un commit sur une branche perso avant la réinitialisation.

## Ce que tu vas apprendre

- Créer des **spans custom** (manuels) pour capturer des concepts métier : étapes du flux de paiement, décisions (approbation, déclin), latences métier.
- Enrichir les spans avec des **attributs métier** : identifiants, montants, états de validation.
- Créer des **événements** (`span.add_event`) pour marquer les transitions critiques dans un span.
- Ajouter des **métriques custom** : compteurs applicatifs (`payments_total`, `payments_declined`), jauges (solde), histogrammes (durée de traitement métier).
- Comprendre la différence entre **erreurs techniques** (exceptions, status HTTP 5xx) et **erreurs métier** (refus de paiement bancaire) — et comment les représenter différemment dans OTel.
- Visualiser et corréler ces signaux métier dans Grafana pour **alerter intelligemment**.

---

## Partie A — Spans custom : anatomie du flux de paiement

L'auto-instrumentation Flask donne déjà un span pour `POST /payments`. Mais elle n'en sait rien des étapes internes : validation du montant, appel à la banque, enregistrement de la commande. On va cartographier ça explicitement.

### A.1. Créer un span parent pour le flux métier

Modifier [payment-service/service.py](../../payment-service/service.py) — importer les APIs et créer un span parent qui englobe tout le traitement :

```python
import logging
import time
from opentelemetry import trace

logger = logging.getLogger("payment")
tracer = trace.get_tracer(__name__)

def process_payment(user_id: str, amount: float) -> tuple[dict | None, str | None]:
    """Process a payment request, returning (payment_dict, error_string)."""
    
    # Span parent : tout le workflow métier
    with tracer.start_as_current_span("payment.process") as span:
        span.set_attribute("payment.user_id", user_id)
        span.set_attribute("payment.amount", amount)
        
        # Étape 1 : validation
        with tracer.start_as_current_span("payment.validate") as val_span:
            if amount <= 0:
                val_span.set_attribute("payment.validation.status", "failed")
                val_span.add_event("validation_failed", {"reason": "negative_amount"})
                return None, "Amount must be positive"
            val_span.set_attribute("payment.validation.status", "passed")
        
        # Étape 2 : appel bancaire
        with tracer.start_as_current_span("payment.bank_call") as bank_span:
            try:
                # Code existant : appel au bank-service via gRPC
                # (l'instrumentation gRPC ajoute déjà un span client, celui-ci l'enveloppe)
                response = _call_bank_service(user_id, amount)
                bank_span.set_attribute("payment.bank_response.approved", response["approved"])
                
                if not response["approved"]:
                    bank_span.add_event("bank_declined", {
                        "reason": response.get("reason", "unknown"),
                        "transaction_id": response.get("transaction_id")
                    })
                    return None, f"Bank declined: {response.get('reason', 'unknown')}"
                
                bank_span.add_event("bank_approved", {
                    "transaction_id": response.get("transaction_id")
                })
            except Exception as e:
                bank_span.record_exception(e)
                bank_span.set_attribute("payment.bank_call.error", str(e))
                return None, f"Bank call failed: {str(e)}"
        
        # Étape 3 : enregistrement (métadonnées)
        with tracer.start_as_current_span("payment.record") as record_span:
            payment_record = {
                "id": f"pay_{user_id}_{int(time.time() * 1000)}",
                "user_id": user_id,
                "amount": amount,
                "status": "completed",
                "timestamp": time.time(),
            }
            record_span.set_attribute("payment.id", payment_record["id"])
            record_span.set_attribute("payment.recorded", True)
        
        span.set_attribute("payment.status", "completed")
        logger.info("payment_approved", extra={
            "user_id": user_id,
            "amount": amount,
            "payment_id": payment_record["id"]
        })
        return payment_record, None
```

Points clés :

- **`tracer.start_as_current_span("payment.process")`** : crée un span nommé `payment.process` qui sera **enfant** du span HTTP du serveur (l'instrumentation Flask l'aura propagé dans le contexte actif).
- **`span.set_attribute(key, value)`** : ajoute une paire clé-valeur au span (devient un label Prometheus ou un champ Loki).
- **`span.add_event(name, attributes)`** : marque un événement horodaté **à l'intérieur** d'un span — utile pour les étapes qui ne méritent pas leur propre span. Les événements restent dans le span et sont visibles en Tempo quand tu déplis le span.
- **`span.record_exception(e)`** : enregistre une exception **sans** la relancer (contrairement à `raise`). Utile pour capturer des erreurs qu'on gère.
- **Spans enfants** : chaque `with tracer.start_as_current_span(...)` imbriqué crée un **span enfant** du contexte courant. Tempo les affichera en hiérarchie.

### A.2. Ajouter une métrique de compteur custom

Toujours dans [payment-service/service.py](../../payment-service/service.py), ajouter les imports et la configuration du compteur :

```python
from opentelemetry import metrics

meter = metrics.get_meter(__name__)
payments_counter = meter.create_counter(
    name="payments_total",
    description="Total number of payment requests processed",
    unit="1"  # dimensionless
)
payments_declined_counter = meter.create_counter(
    name="payments_declined_total",
    description="Total number of declined payments",
    unit="1"
)
```

Puis, dans `process_payment()`, incrémenter les compteurs aux points clés :

```python
def process_payment(user_id: str, amount: float) -> tuple[dict | None, str | None]:
    """..."""
    
    with tracer.start_as_current_span("payment.process") as span:
        payments_counter.add(1, {"status": "attempted"})
        
        # ... validation ...
        
        if amount <= 0:
            payments_declined_counter.add(1, {"reason": "validation_failed"})
            return None, "Amount must be positive"
        
        # ... validation OK ...
        
        if not response["approved"]:
            payments_declined_counter.add(1, {"reason": "bank_declined"})
            return None, f"Bank declined: ..."
        
        # ... success ...
        payments_counter.add(1, {"status": "approved"})
    
    return payment_record, None
```

> Les compteurs peuvent avoir un `description` et un `unit`. Le `unit` est une convention (voir [UCUM](https://ucum.org/) pour les standards) — ici on laisse `"1"` pour sans-dimension. Les **attributs** (dico passé en second argument) deviennent des labels Prometheus : tu pourras faire un `rate(payments_total{status="approved"}[1m])` en Grafana.

### A.3. Importer et utiliser dans `app.py`

Modifier [payment-service/app.py](../../payment-service/app.py) — s'assurer que `service.process_payment()` est appelée où elle doit l'être :

```python
from service import process_payment

@app.route("/payments", methods=["POST"])
def create_payment():
    data = request.get_json()
    if not data or not data.get("user_id") or data.get("amount") is None:
        return jsonify({"error": "user_id and amount are required"}), 400

    payment, error = process_payment(data["user_id"], data["amount"])
    if error:
        return jsonify({"error": error, "payment_id": None}), 402

    return jsonify(payment), 201
```

(Pas de changement majeur — c'est juste pour vérifier que le flow n'est pas cassé.)

### A.4. Builder et tester

```bash
task build:payment-service
task stack:up
```

Générer du trafic avec succès et erreurs :

```bash
# Paiement valide
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "john", "amount": 50.00}'

# Paiement invalide (montant négatif)
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "jane", "amount": -10.00}'
```

### A.5. Observer les spans et événements

Dans Grafana Cloud / Tempo, cherche une trace avec `service.name = payment-service`. Elle doit maintenant contenir :

- 1 span root : `POST /payments` (Flask auto-instrument)
  - 1 span enfant : `payment.process` (custom)
    - 1 span enfant : `payment.validate`
    - 1 span enfant : `payment.bank_call` (qui lui-même contient un span gRPC enfant via l'instrumentation)
    - 1 span enfant : `payment.record`

Déplie chaque span pour voir ses attributs et événements. Par exemple, `payment.bank_call` doit montrer un événement `bank_approved` ou `bank_declined`.

### A.6. Métriques dans Grafana

Dans Prometheus ou Explorer > Metrics, cherche :

```
payments_total{student_id="<ton-id>", status="attempted"}
payments_total{student_id="<ton-id>", status="approved"}
payments_declined_total{student_id="<ton-id>", reason="bank_declined"}
```

Tu dois voir les compteurs augmenter avec tes requêtes.

---

## Partie B — Histogramme custom pour la latence métier

Les compteurs sont cumulatifs. Pour mesurer des **durées**, on utilise un histogramme — une distribution qui aggrège des valeurs dans des buckets.

### B.1. Créer un histogramme

Modifier [payment-service/service.py](../../payment-service/service.py) — ajouter aux définitions de métriques :

```python
payment_latency_histogram = meter.create_histogram(
    name="payment_processing_duration_ms",
    description="Time spent processing a payment request (business logic only)",
    unit="ms"
)
```

### B.2. Enregistrer les mesures au début et à la fin

Modifier `process_payment()` :

```python
import time

def process_payment(user_id: str, amount: float) -> tuple[dict | None, str | None]:
    """..."""
    start_time = time.time()
    outcome = "unknown"
    
    with tracer.start_as_current_span("payment.process") as span:
        span.set_attribute("payment.user_id", user_id)
        span.set_attribute("payment.amount", amount)
        payments_counter.add(1, {"status": "attempted"})
        
        # ... validation ...
        
        if amount <= 0:
            outcome = "declined"
            payments_declined_counter.add(1, {"reason": "validation_failed"})
            return None, "Amount must be positive"
        
        # ... bank call ...
        
        if not response["approved"]:
            outcome = "declined"
            payments_declined_counter.add(1, {"reason": "bank_declined"})
            return None, f"Bank declined: ..."
        
        # ... success ...
        outcome = "approved"
        payments_counter.add(1, {"status": "approved"})
    
    # Enregistrer la durée après le span (mesure le temps réel du span)
    end_time = time.time()
    duration_ms = (end_time - start_time) * 1000
    payment_latency_histogram.record(duration_ms, {"outcome": outcome})
    
    return payment_record, None
```

Cet histogramme sera côté **métier** (durée du processus métier), distincte de l'histogramme HTTP (qui inclut la sérialisation, le réseau, etc.) déjà fourni par Flask.

---

## Partie C — Distinction erreurs techniques vs erreurs métier

Un piège courant : marquer un "déclin bancaire" comme une **erreur HTTP 5xx** (ce qui trigger des alertes, pinging l'on-call). Mais c'est une **réponse métier valide**, pas un bug technique.

### C.1. Status HTTP cohérent avec la réalité

Modifier [payment-service/app.py](../../payment-service/app.py) — s'assurer que les codes retour sont justes :

```python
@app.route("/payments", methods=["POST"])
def create_payment():
    data = request.get_json()
    if not data or not data.get("user_id") or data.get("amount") is None:
        # Erreur de validation client → 400 Bad Request
        return jsonify({"error": "user_id and amount are required"}), 400

    payment, error = process_payment(data["user_id"], data["amount"])
    if error:
        # Erreur métier (montant invalide, banque refuse) → 402 Payment Required
        # PAS 502 Bad Gateway, qui veut dire "le service derrière a crashé"
        return jsonify({"error": error, "payment_id": None}), 402

    return jsonify(payment), 201
```

Le span HTTP Flask l'enregistrera avec `http.status_code = 402`, qui **ne compte pas** comme erreur serveur. Tes SLA restent propres.

### C.2. Attributs métier pour catégoriser les déclines

Modifier [payment-service/service.py](../../payment-service/service.py) — ajouter des attributs au span root pour qu'on puisse filtrer en Grafana :

```python
def process_payment(user_id: str, amount: float) -> tuple[dict | None, str | None]:
    """..."""
    
    with tracer.start_as_current_span("payment.process") as span:
        span.set_attribute("payment.user_id", user_id)
        span.set_attribute("payment.amount", amount)
        span.set_attribute("payment.flow", "standard")
        
        # ... validations ...
        
        if not response["approved"]:
            span.set_attribute("payment.decline_reason", response.get("reason"))
            span.set_attribute("payment.decline_category", "bank_policy")
            # ... retour erreur ...
        
        span.set_attribute("payment.outcome", "approved")  # ou "declined"
        
    return payment_record, error
```

Puis en Grafana, tu peux filtrer Tempo avec `{ payment.outcome = "declined" AND payment.decline_category = "bank_policy" }` pour analyser un sous-ensemble spécifique.

---

## Partie D — Corréler traces, métriques, logs sur une même trace

C'est là que tout se noue : le même `trace_id` relie tous les signaux.

### D.1. Logs enrichis avec contexte OTel

Modifier [payment-service/service.py](../../payment-service/service.py) — ajouter des logs à côté de chaque étape critique :

```python
def process_payment(user_id: str, amount: float) -> tuple[dict | None, str | None]:
    """..."""
    logger = logging.getLogger("payment")
    
    with tracer.start_as_current_span("payment.process") as span:
        logger.info("processing_payment_request", extra={
            "user_id": user_id,
            "amount": amount
        })
        
        # ... validation ...
        
        with tracer.start_as_current_span("payment.validate"):
            if amount <= 0:
                logger.warning("validation_failed", extra={"reason": "negative_amount"})
                return None, "Amount must be positive"
        
        # ... appel bancaire ...
        
        if not response["approved"]:
            logger.warning("payment_declined", extra={
                "decline_reason": response.get("reason"),
                "transaction_id": response.get("transaction_id")
            })
            return None, f"Bank declined: ..."
        
        logger.info("payment_approved", extra={
            "user_id": user_id,
            "amount": amount,
            "payment_id": payment_record["id"]
        })
    
    return payment_record, None
```

Chaque log va automatiquement **hériter du `trace_id`** du span courant (via le `LoggingInstrumentor` de l'exo 3). En Grafana Loki, tu peux faire `{trace_id="feeac4..."}` et tu verras tous les logs de cette trace.

### D.2. Vérifier en Grafana

1. **Tempo** : cherche une trace avec plusieurs spans `payment.*`.
2. **Prometheus** : visualise `rate(payments_total[5m])` et `rate(payments_declined_total[5m])` côte à côte.
3. **Loki** : cherche les logs avec le même `trace_id`.
4. Clique sur les **liens cross-signal** : Grafana corrèle automatiquement via `trace_id` et `student_id`.

---

## Analyse : la chaîne complète avec instrumentation custom

```text
┌─ Requête HTTP ────────────────────────────────────────────────┐
│                                                                 │
│  POST /payments {user_id, amount}                             │
│          │                                                      │
│          ├─ Flask auto-instrument        → span: POST /payments │
│          │                                                      │
│          ├─ service.process_payment()                         │
│          │   │                                                  │
│          │   ├─ span: payment.process                          │
│          │   │   attr: user_id, amount, outcome               │
│          │   │   │                                              │
│          │   │   ├─ span: payment.validate                     │
│          │   │   │   event: validation_failed | validation_ok  │
│          │   │   │                                              │
│          │   │   ├─ span: payment.bank_call                    │
│          │   │   │   │                                          │
│          │   │   │   └─ gRPC auto-instrument (client)          │
│          │   │   │       └─ bank-service: span (server)        │
│          │   │   │                                              │
│          │   │   └─ span: payment.record                       │
│          │   │                                                  │
│          │   └─ meter.record() : latency_ms                    │
│          │                                                      │
│          └─ HTTP 402 (Payment Required) or 201 (OK)            │
│                                                                 │
│  Tout ceci partage un trace_id et student_id.                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

↓ Collecteur OTel (processor resource/student, batch, memory_limiter)

┌─ Grafana Cloud ──────────────────────────────────────────────┐
│                                                                │
│  Tempo: Traces avec hiérarchie payment.* + bank-service tree  │
│  Prometheus: Counters, histograms                             │
│  Loki: Logs avec trace_id, tous sur la même requête           │
│                                                                │
│  Cross-linking: clique span → logs, metrics → traces          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Trois observations finales :

1. **Les spans custom s'imbriquent** dans l'arbre généré par auto-instrumentation. Pas de doublons, hiérarchie propre.
2. **Les événements** donnent de la granularité sans exploser le nombre de spans (10 déclines différents = 10 logs + 1 événement par span, pas 10 spans).
3. **Le même `trace_id` sur tous les signaux** = unicité. Une trace = un chemin logique métier, visible sur 3 backends différents.

## Critères de validation

- [ ] **Spans custom** : Un `POST /payments` génère au moins 5 spans (HTTP root + payment.process + validate + bank_call + record).
- [ ] **Attributs métier** : Chaque span `payment.*` a des attributs (`user_id`, `amount`, `outcome`…) visibles dans Tempo.
- [ ] **Événements** : Déplie `payment.bank_call` et tu vois un événement `bank_approved` ou `bank_declined`.
- [ ] **Compteurs** : `payments_total` et `payments_declined_total` existent et augmentent. Les attributs (`status`, `reason`) sont visibles en Prometheus.
- [ ] **Histogramme** : `payment_processing_duration_ms` est visible en Prometheus avec des quantiles (p50, p95, p99).
- [ ] **Logs corrélés** : Fais une requête, cherche le `trace_id` dans Loki. Tu trouves tous les logs de cette trace.
- [ ] **Status code** : Les déclines retournent HTTP 402, pas 502.
- [ ] **Cross-linking** : Dans Tempo, clique "Logs" en bas d'une trace → tu vois les logs Loki avec le même `trace_id`.

## Pour aller plus loin

- **Sampling** : ajouter un processor `tail_sampling` au collecteur pour garder 100 % des déclines et seulement 5 % des approbations. Voir `docs/04-observability.md`.
- **Baggage** : utiliser `opentelemetry.baggage` pour propager des attributs métier à travers toute une requête sans les passer explicitement.
- **Autres types de spans** : spans **links** (une requête triggered par une autre), spans avec **kind=INTERNAL** vs **kind=SERVER**.
- **Métriques conditionnelles** : `payment_duration_by_tier` (premium vs standard) — c'est juste ajouter des attributs aux histogrammes.
- **SLOs** : « 95 % des paiements approved < 500ms » — requête Grafana sur `payment_processing_duration_ms`.

## Étape suivante

Ça y est ! Tu viens de compléter une **stack d'observabilité complète** :

- ✅ **Traces** (auto + custom) : `payment.process` divisé en étapes, contexte distribué Python → Go.
- ✅ **Métriques** (auto + custom) : compteurs métier, histogrammes de latence.
- ✅ **Logs** (corrélés) : chaque action loggée, reliée à sa trace.
- ✅ **Collecteur** : pipeline centralisé, enrichissement par étudiant, export Grafana.

Explore Grafana Cloud dashboards et configure des alertes pour tes KPIs — tu as maintenant **toute l'observabilité** pour debugger en production. 🎉
