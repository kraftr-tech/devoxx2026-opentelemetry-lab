# Étape 4 — Le collecteur OpenTelemetry : export Grafana Cloud et tagging par étudiant

> Branche : `step-4-collector`
> Durée estimée : 25 min
> État à l'arrivée : tous les services exportent désormais **en OTLP vers le collecteur** (les `ConsoleXxxExporter` ont été remplacés par les `OTLPXxxExporter` — travail de l'animateur sur la base de l'exo 3). Pourtant, **rien n'apparaît encore dans Grafana Cloud**. On va comprendre pourquoi, corriger, puis tagger nos signaux pour se retrouver parmi les autres participants qui utilisent la même instance.

## Préparation : passer sur la branche `step-4-collector`

Tu arrives de l'exo 3 avec des modifications locales sur `step-3-logs`. On les **écarte** pour récupérer l'état propre de `step-4-collector` (solution de référence de l'exo 3 + bascule OTLP + point de départ de l'exo 4).

```bash
# 1. Annule toutes les modifications locales sur les fichiers suivis
git reset --hard

# 2. Supprime les fichiers non suivis
git clean -fd

# 3. Bascule sur la branche de l'exo 4
git checkout step-4-collector
```

> ⚠️ Ces commandes **détruisent** ton travail local de l'exo 3. Si tu veux conserver ta solution, fais d'abord un `git stash` ou un commit sur une branche perso avant la réinitialisation.

## Ce que tu vas apprendre

- L'anatomie d'une config OTel Collector : **receivers → processors → exporters → pipelines**.
- La différence entre **déclarer un exporter** et le **brancher dans une pipeline** (c'est là où le bât blesse aujourd'hui).
- Utiliser un processor **`resource`** pour enrichir toute la télémétrie avec un attribut custom, au niveau du collecteur plutôt qu'au niveau du code.
- Valider la chaîne complète : service Python → collecteur → Grafana Cloud, pour les **trois signaux** simultanément, avec un tag qui isole tes données.

---

## Partie A — Brancher le collecteur vers Grafana Cloud

### Pourquoi rien n'arrive côté Grafana ?

Ouvre [configs/otelcol-config.yaml](../../configs/otelcol-config.yaml). Regarde la section `exporters` :

```yaml
exporters:
  debug:
    verbosity: detailed
  otlphttp/grafana_cloud:
    endpoint: "${env:GRAFANA_CLOUD_OTLP_ENDPOINT}"
    auth:
      authenticator: basicauth/grafana_cloud
```

L'exporter vers Grafana Cloud est **bien déclaré**. Il sait où aller, il sait s'authentifier. Mais regarde maintenant la section `service.pipelines` :

```yaml
service:
  extensions: [basicauth/grafana_cloud]
  pipelines:
    traces:
      receivers: ["otlp"]
      processors: ["memory_limiter", "batch"]
      exporters: ["debug"]
    metrics:
      ...
      exporters: ["debug"]
    logs/otlp:
      ...
      exporters: ["debug"]
```

Chaque pipeline n'a **qu'un seul exporter** : `debug`, qui imprime tout sur stdout du collecteur. L'exporter `otlphttp/grafana_cloud` est orphelin — déclaré mais jamais invoqué. C'est une erreur classique : croire qu'il suffit de *déclarer* une config OTel pour qu'elle soit active. Dans le modèle OTel Collector, une ressource n'est utilisée que si elle est **explicitement référencée** dans `service.pipelines`.

### A.1. Vérifier les credentials Grafana Cloud

Le collecteur lit les credentials depuis l'environnement. Vérifier qu'elles sont bien définies :

```bash
mise env | grep GRAFANA_CLOUD
```

Tu dois voir trois variables : `GRAFANA_CLOUD_OTLP_ENDPOINT`, `GRAFANA_CLOUD_INSTANCE_ID`, `GRAFANA_CLOUD_API_KEY`. Sinon, les ajouter dans `mise.local.toml` (voir [docs/03-deployment-k3d.md](../03-deployment-k3d.md#credentials-grafana-cloud)).

### A.2. Déclarer et activer l'extension `basicauth/grafana_cloud`

Regarde la définition de l'exporter `otlphttp/grafana_cloud` :

```yaml
exporters:
  otlphttp/grafana_cloud:
    endpoint: "${env:GRAFANA_CLOUD_OTLP_ENDPOINT}"
    auth:
      authenticator: basicauth/grafana_cloud   # ← référence à une extension
```

Il référence une **extension** d'authentification nommée `basicauth/grafana_cloud`, qui n'existe pas encore. Une extension OTel Collector doit être **déclarée** (top-level `extensions:`) **puis activée** dans `service.extensions` — les deux étapes sont nécessaires.

Dans [configs/otelcol-config.yaml](../../configs/otelcol-config.yaml), ajouter le bloc `extensions:` et activer l'extension :

```yaml
extensions:                                      # ← nouveau bloc top-level
  basicauth/grafana_cloud:
    client_auth:
      username: "${env:GRAFANA_CLOUD_INSTANCE_ID}"
      password: "${env:GRAFANA_CLOUD_API_KEY}"

service:
  extensions: [basicauth/grafana_cloud]          # ← activation obligatoire
  pipelines:
    # ... pipelines inchangées pour l'instant
```

> ⚠️ **Piège classique** : déclarer l'extension sans l'activer dans `service.extensions` revient à ne pas l'avoir du tout. Le collecteur ne lève pas d'erreur claire au démarrage — il échoue à l'export avec un message cryptique type « authenticator not found ». Les deux étapes sont **indépendantes** et **obligatoires**.

### A.3. Brancher `otlphttp/grafana_cloud` dans les trois pipelines

Modifier [configs/otelcol-config.yaml](../../configs/otelcol-config.yaml) — pour **chacune** des trois pipelines, ajouter `otlphttp/grafana_cloud` à la liste `exporters` :

```yaml
service:
  extensions: [basicauth/grafana_cloud]
  pipelines:
    traces:
      receivers: ["otlp"]
      processors: ["memory_limiter", "batch"]
      exporters: ["debug", "otlphttp/grafana_cloud"]   # ← ajout
    metrics:
      receivers: ["otlp"]
      processors: ["memory_limiter", "batch"]
      exporters: ["debug", "otlphttp/grafana_cloud"]   # ← ajout
    logs/otlp:
      receivers: ["otlp"]
      processors: ["memory_limiter", "batch"]
      exporters: ["debug", "otlphttp/grafana_cloud"]   # ← ajout
```

On garde `debug` pour continuer à voir ce qui transite dans le collecteur (utile pour débugger), et on ajoute `otlphttp/grafana_cloud` pour le forward distant. Un même signal peut être envoyé à **plusieurs exporters** en parallèle (pattern **fanout**) — c'est un des intérêts majeurs du collecteur.

### A.4. Redémarrer et tester

```bash
task stack:up
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-42", "amount": 49.90}'
```

Dans les logs du collecteur :

```bash
task stack:logs -- otel-collector
```

Attendu : toujours les spans imprimés par l'exporter `debug`, **pas d'erreur** d'auth (`401 Unauthorized`, `rpc error: Unauthenticated`), pas de ligne `exporterhelper` avec `dropped items`.

➡️ À ce stade, tes données atteignent Grafana Cloud. Mais si tu vas sur Explore → Tempo → filtre `service.name = payment-service`, tu vas voir **les données de tous les participants en même temps** — chacun envoie vers la même instance. On règle ça Partie B.

---

## Partie B — Tagger les signaux par étudiant

Tous les participants de l'atelier utilisent la **même instance Grafana Cloud**. Sans tag de distinction, impossible d'isoler ta propre télémétrie : les traces et métriques de tout le monde se mélangent dans les dashboards.

On va ajouter un attribut `student.id` à **tous les signaux** au niveau du collecteur, via un processor `resource`. Pourquoi au collecteur plutôt que dans le code des services ?

- **Un seul point de configuration** — quelle que soit la source (Python, Go, ajouts futurs), tout ce qui transite par le collecteur reçoit le tag.
- **Cohérence garantie** — pas de risque qu'un service émette sans le tag.
- **Pas de rebuild** — on ne touche ni aux images Docker ni au code.

### B.1. Choisir ton `student.id`

Prénom-nom, trigramme, GitHub handle — peu importe tant que c'est **unique et stable** dans ta session. Exemples :

- `marie-dupont`
- `jdoe`
- `team-alice`

Évite les espaces et caractères spéciaux : ça deviendra un label Prometheus/Loki côté Grafana.

### B.2. Déclarer le processor `resource/student`

Modifier [configs/otelcol-config.yaml](../../configs/otelcol-config.yaml) — dans la section `processors`, ajouter **une** nouvelle entrée à côté de `batch` et `memory_limiter`, en mettant ta valeur **en dur** :

```yaml
processors:
  batch:
    timeout: 5s
  memory_limiter:
    check_interval: 5s
    limit_percentage: 80
    spike_limit_percentage: 25
  resource/student:                                      # ← nouveau
    attributes:
      - key: student.id
        value: "marie-dupont"                            # ← ton identifiant ici
        action: upsert
```

Points à noter :

- **`resource/student`** : le nom utilise le préfixe de type (`resource`) suivi d'un **alias** libre (`student`) — convention OTel pour pouvoir configurer plusieurs instances du même processor.
- **`action: upsert`** : ajoute l'attribut s'il n'existe pas, le remplace s'il existe. Alternative : `insert` (n'écrase pas), `update` (ne crée pas), `delete`.
- **Valeur en dur** : on aurait pu utiliser `${env:STUDENT_ID}` et passer la variable via `docker-compose.yml` / `mise.local.toml`, mais pour un atelier où chaque participant configure sa propre instance, la valeur inline est plus directe et moins sujette à erreurs de plomberie.

### B.3. Brancher le processor dans les trois pipelines

Toujours dans [configs/otelcol-config.yaml](../../configs/otelcol-config.yaml), ajouter `resource/student` à la liste `processors` de chaque pipeline :

```yaml
service:
  extensions: [basicauth/grafana_cloud]
  pipelines:
    traces:
      receivers: ["otlp"]
      processors: ["memory_limiter", "resource/student", "batch"]   # ← ajout
      exporters: ["debug", "otlphttp/grafana_cloud"]
    metrics:
      receivers: ["otlp"]
      processors: ["memory_limiter", "resource/student", "batch"]   # ← ajout
      exporters: ["debug", "otlphttp/grafana_cloud"]
    logs/otlp:
      receivers: ["otlp"]
      processors: ["memory_limiter", "resource/student", "batch"]   # ← ajout
      exporters: ["debug", "otlphttp/grafana_cloud"]
```

> **L'ordre des processors compte.** `memory_limiter` reste en **premier** (il doit pouvoir dropper les signaux en surcharge **avant** qu'on perde du travail à les enrichir). `resource/student` juste après (on enrichit tout ce qui passe). `batch` en **dernier** (on groupe les signaux déjà enrichis pour l'export).

### B.4. Redémarrer et vérifier

```bash
task stack:up
curl -X POST http://localhost:8003/payments \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-42", "amount": 49.90}'
```

Côté logs du collecteur (exporter `debug`) :

```bash
task stack:logs -- otel-collector | grep -A1 "student.id"
```

Tu dois voir `student.id: Str(marie-dupont)` dans les `Resource attributes` des signaux.

### B.5. Filtrer dans Grafana Cloud

Attention : les noms d'attributs avec un point sont normalisés différemment selon le backend :

| Backend | Requête |
| --- | --- |
| **Tempo** (traces) | `{ resource.student.id = "marie-dupont" }` (TraceQL) |
| **Prometheus** (metrics) | `http_server_duration{student_id="marie-dupont"}` (le `.` devient `_`) |
| **Loki** (logs) | `{student_id="marie-dupont"}` (idem) |

➡️ Dans Explore, tu vois maintenant **uniquement tes propres données** — les autres participants sont filtrés.

---

## Analyse : la chaîne complète

```text
Python services ──OTLP HTTP──▶ otel-collector ──processors──▶ exporters ──┬──▶ debug (stdout collecteur)
                                               ↑                          └──▶ otlphttp/grafana_cloud ──▶ Grafana Cloud
bank-service (Go) ──OTLP HTTP──┘               │
                                               ├─ memory_limiter (protection)
                                               ├─ resource/student (ajoute student.id)
                                               └─ batch (groupage avant export)
```

Quatre observations :

1. **Les pipelines sont des fanouts**. Un span entrant est recopié vers chaque exporter listé. On garde `debug` pour le debug local en même temps qu'on pousse vers Grafana Cloud — sans doublon de config côté services.
2. **Les processors s'appliquent dans l'ordre déclaré**. Inverser `resource/student` et `batch` changerait rien ici (batch ne touche pas les attributs), mais inverser `memory_limiter` avec le reste casserait la protection. Règle de pouce : `memory_limiter` en premier, `batch` en dernier, enrichissements au milieu.
3. **L'attribution au niveau collecteur est une technique puissante**. On peut imaginer d'autres processors `resource/*` pour tagger selon l'environnement (`deployment.environment`), la région (`cloud.region`), la version du stack (`workshop.version`)… sans toucher au code des services.
4. **Tu viens d'étendre la corrélation cross-service avec une dimension multi-tenant**. Le même `trace_id` continue de traverser tes services, et en plus il porte ton `student.id` — tu peux maintenant reconstituer **ta** trace complète dans Grafana sans polluer par celle des autres.

## Critères de validation

- [ ] **Partie A** : Le collecteur démarre sans erreur d'auth (`task stack:logs -- otel-collector`).
- [ ] **Partie A** : Dans Grafana Cloud / Tempo, un `POST /payments` est visible comme une trace avec au moins 4 spans partageant le même `trace_id`, sur les services `payment-service` et `bank-service`.
- [ ] **Partie A** : Dans la vue Loki, on retrouve les logs `payment_approved` ou `checkout_started` associés à la même trace.
- [ ] **Partie B** : Les logs `debug` du collecteur montrent `student.id: Str(<ton-id>)` sur tous les signaux.
- [ ] **Partie B** : Le filtre TraceQL `{ resource.student.id = "<ton-id>" }` ramène **uniquement** tes traces, pas celles des autres participants.
- [ ] **Partie B** : Un `rate(http_server_duration_milliseconds_count{student_id="<ton-id>"}[1m])` dans Prometheus isole tes métriques.

## Pour aller plus loin

- **Les extensions** : `basicauth/grafana_cloud` est une *extension* (listée dans `service.extensions`), pas un processor. Les extensions étendent le collecteur sans être dans la pipeline de données : auth, zpages (debug UI), health_check, pprof…
- **Autres processors utiles en prod** :
  - `resource` pour ajouter `deployment.environment=prod`, `cloud.region=eu-west-1`…
  - `filter` ou `tail_sampling` pour échantillonner les traces (garder 100 % des erreurs, 1 % du reste).
  - `attributes` pour supprimer de la PII (`http.url`) ou renommer des clés.
  - `transform` pour des modifications plus complexes via le langage OTTL.
- **Chemin Kubernetes** : sur k3d, le même tagging se ferait dans [manifests/rs-collector.yaml](../../manifests/rs-collector.yaml), avec la valeur substituée à l'apply via `kustomize build | sed` (voir [docs/03-deployment-k3d.md](../03-deployment-k3d.md)).
- **gRPC vs HTTP** : le receiver du collecteur écoute les deux (`4317` gRPC, `4318` HTTP). Nos services Python et Go utilisent `http/protobuf` — plus simple à débugger. Côté export vers Grafana Cloud, on utilise `otlphttp` — évite les soucis de proxies/TLS.

## Étape suivante

Une fois tes trois signaux visibles dans Grafana, isolés par ton `student.id`, direction `step5-add-custom.md` (à venir).

L'exercice 5 portera sur l'**instrumentation custom** du `payment-service` : spans métier manuels, attributs riches, events, et gestion fine des erreurs vs statuts métier (bank decline n'est pas une erreur technique).
