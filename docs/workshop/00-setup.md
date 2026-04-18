# Setup du workshop

À faire **une seule fois** avant le début de l'atelier. Compte ~15 min avec une bonne connexion.

## 1. Outils

```bash
# Cloner le repo
git clone https://github.com/kraftr-tech/devoxx2026-opentelemetry-lab.git
cd devoxx2026-opentelemetry-lab

# Installer les outils via mise (Go, Node, protoc, k3d, kubectl, kustomize, k6…)
mise install
```

Si tu n'as pas `mise` : <https://mise.jdx.dev/getting-started.html>.

Alternative sans mise : installer manuellement `docker`, `k3d`, `kubectl`, `kustomize`, `task`, `k6` — versions dans [mise.toml](../../mise.toml).

## 2. Docker démarré

```bash
docker info
```

Doit répondre sans erreur.

## 3. Première exécution Docker Compose

Sanity check local (sans Kubernetes) :

```bash
task stack:up
```

Ouvrir <http://localhost:3000>. Se connecter avec `john.doe@kraftr.tech` / `client123`. Ajouter un produit au panier, faire un checkout. Si tu vois un écran "Order confirmed" ou un déclin (`402`), **tout roule**.

Arrêter :

```bash
task stack:down
```

## 4. Credentials Grafana Cloud

Distribués en début d'atelier. Ajouter dans un fichier **non commité** à la racine du repo :

`mise.local.toml` :

```toml
[env]
GRAFANA_CLOUD_OTLP_ENDPOINT = "https://otlp-gateway-prod-XX.grafana.net/otlp"
GRAFANA_CLOUD_INSTANCE_ID = "123456"
GRAFANA_CLOUD_API_KEY = "glc_eyJvIjoi..."
```

Vérifier que mise les prend bien :

```bash
mise env | grep GRAFANA_CLOUD
```

## 5. Créer et initialiser le cluster k3d

```bash
task cluster:create
task cluster:init
task cluster:load
task cluster:apply
```

Vérifier :

```bash
kubectl get pods -A
```

Tous les pods des namespaces `workshop`, `observability`, `opentelemetry-operator-system`, `flux-system` doivent être `Running`.

## 6. Accéder à l'application et à Grafana

```bash
# App
kubectl -n workshop port-forward svc/ui 3000:8080

# Grafana local (si déployé)
kubectl -n observability port-forward svc/grafana 3001:80
```

## Tu es prêt

Direction [step1-add-traces.md](step1-add-traces.md) pour le premier exercice.

En cas de pépin, voir [docs/06-troubleshooting.md](../06-troubleshooting.md).
