# Troubleshooting

Erreurs les plus fréquemment rencontrées pendant l'atelier.

## Docker Compose

### `port is already allocated`

Un autre process écoute déjà sur un des ports `3000`, `8001`–`8004`, `50051`, `4317`, `4318`.

```bash
lsof -iTCP:3000 -sTCP:LISTEN   # identifier le coupable
```

Arrête-le, ou modifie le mapping dans [docker-compose.yml](../docker-compose.yml).

### L'app n'affiche pas les produits

Vérifier que `products-service` est bien up :

```bash
docker compose ps
curl http://localhost:8002/health
```

Si la base est vide, le seed ne s'est pas joué — reset :

```bash
task stack:down && task stack:up
```

### Le collecteur boucle en erreur d'auth

Les variables `GRAFANA_CLOUD_*` ne sont pas exportées. L'app fonctionne quand même ; pour les activer, voir [04-observability.md](04-observability.md).

## k3d / Kubernetes

### `ImagePullBackOff` sur les pods workshop

Les images n'ont pas été poussées dans le registry du cluster :

```bash
task cluster:load
```

Vérifier que le registry est bien connecté :

```bash
docker ps | grep k3d-workshop-registry
```

### `task cluster:apply` échoue : variables manquantes

```text
task: [cluster:apply] ... required variable GRAFANA_CLOUD_OTLP_ENDPOINT is not set
```

Exporte les trois variables `GRAFANA_CLOUD_*` (voir [03-deployment-k3d.md](03-deployment-k3d.md)) ou déclare-les dans `mise.local.toml`.

### Auto-instrumentation Python non injectée

Le pod `users-service` (ou autre) n'a pas l'init-container `opentelemetry-auto-instrumentation` :

```bash
kubectl -n workshop describe pod <pod>
```

Causes classiques :

- L'annotation `instrumentation.opentelemetry.io/inject-python` est absente du Deployment → vérifier [manifests/rs-services.yaml](../manifests/rs-services.yaml).
- La ressource `Instrumentation` `python-instrumentation` n'est pas dans le namespace `workshop` ou n'est pas encore prête.
- L'OTel Operator n'est pas up : `kubectl -n opentelemetry-operator-system get pods`.

### `kubeconfig.yaml` introuvable

Il est généré par `task cluster:create` à la racine du repo. [mise.toml](../mise.toml) pointe `KUBECONFIG` dessus. Si tu lances `kubectl` hors de mise, exporte manuellement :

```bash
export KUBECONFIG=$PWD/kubeconfig.yaml
```

## gRPC / bank-service

### `connection refused` depuis payment-service

`BANK_SERVICE_HOST` ne pointe pas au bon endroit.

- En Compose : doit être `bank-service:50051`.
- En k8s : doit être `bank-service:8080` (Service k8s expose 8080).

### Taux de déclin anormalement élevé

Normal — le `bank-service` simule ~10 % de déclin aléatoire. Les réponses HTTP 402 renvoyées par `billing-service` ne sont **pas** des erreurs applicatives. Voir [k6/README.md](../k6/README.md).

## Où creuser ensuite

- Logs collecteur : `task stack:logs`
- Logs d'un service Compose : `task stack:logs -- <service>`
- Logs d'un pod Kubernetes : `kubectl -n workshop logs -f deploy/<service>`
- Grafana local (k3d) : port-forward, voir [03-deployment-k3d.md](03-deployment-k3d.md)
