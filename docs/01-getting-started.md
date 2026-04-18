# Démarrage rapide

Démarre la stack **Atelier** en local avec Docker Compose. Pour le déploiement Kubernetes, voir [03-deployment-k3d.md](03-deployment-k3d.md).

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) avec le plugin `compose`
- [mise](https://mise.jdx.dev) — gère les versions des outils (Go, Node, protoc, k3d, kubectl, k6…)

Les versions exactes sont déclarées dans [mise.toml](../mise.toml).

```bash
mise install
```

## Lancer la stack

```bash
task stack:up
```

Six conteneurs démarrent (5 microservices + UI), plus un collecteur OpenTelemetry. La commande passe par `mise exec` : les variables `GRAFANA_CLOUD_*` de ton `mise.local.toml` sont injectées dans le collecteur.

L'application est disponible sur **<http://localhost:3000>**.

> **Note collecteur** : le service `otel-collector` du Compose exporte vers Grafana Cloud. Si tu n'as pas les credentials, le collecteur démarre mais l'export échoue silencieusement — l'application reste pleinement fonctionnelle. Voir [04-observability.md](04-observability.md) pour configurer l'export.

## Se connecter

Deux comptes sont créés au premier démarrage :

| Rôle           | Email                     | Mot de passe |
| -------------- | ------------------------- | ------------ |
| Administrateur | `admin@kraftr.tech`       | `admin123`   |
| Client         | `john.doe@kraftr.tech` | `client123`  |

- **Admin** → accès au backoffice (gestion produits).
- **Client** → shop, panier, checkout.

## Vérifier que tout tourne

Tailer les logs du collecteur (ou d'un autre service via `CLI_ARGS`) :

```bash
task stack:logs                          # otel-collector par défaut
task stack:logs -- users-service         # autre service
```

Santé des services :

```bash
curl http://localhost:8001/health   # users-service
curl http://localhost:8002/health   # products-service
curl http://localhost:8003/health   # payment-service
curl http://localhost:8004/health   # billing-service
```

Simuler du trafic avec k6 :

```bash
task load:client-journey
```

Voir [k6/README.md](../k6/README.md) pour le détail.

## Arrêter la stack

```bash
task stack:down
```

> `task stack:down` passe l'option `-v` : les volumes SQLite sont **supprimés**, chaque redémarrage repart donc sur un seed frais. Si tu veux conserver les données, reste avec `docker compose down` (sans `-v`) à la main.

## Étape suivante

- Pour le workshop : [workshop/README.md](workshop/README.md)
- Pour Kubernetes : [03-deployment-k3d.md](03-deployment-k3d.md)
