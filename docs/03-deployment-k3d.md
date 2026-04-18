# Déploiement sur k3d

Déploiement de la stack sur un cluster Kubernetes local via **k3d**. C'est ce mode qui est utilisé pendant le workshop pour démontrer l'auto-instrumentation zero-code via l'OpenTelemetry Operator.

> Pour un simple test local sans Kubernetes, utilise Docker Compose : voir [01-getting-started.md](01-getting-started.md).

## Prérequis

- Docker
- `mise install` a déjà installé : `k3d`, `kubectl`, `kustomize`, `task`

## 1. Créer le cluster

```bash
task cluster:create
```

Crée :

- un registry local `k3d-workshop-registry:5000`,
- un cluster k3d nommé `workshop` avec les ports `8080` et `8443` du load balancer exposés sur l'hôte,
- un `kubeconfig.yaml` à la racine du repo (sourcé automatiquement grâce à [mise.toml](../mise.toml) → `KUBECONFIG`).

## 2. Installer les opérateurs

```bash
task cluster:init
```

Installe le **Flux Operator** (via Helm) qui pilotera ensuite les `ResourceSet` du dossier [manifests/](../manifests/).

## 3. Build et push des images

```bash
task cluster:load
```

Build toutes les images Docker puis les pousse dans le registry local du cluster.

## 4. Déployer la stack

```bash
task cluster:apply
```

Applique les manifests via `kustomize build manifests/ | kubectl apply -f -`.

Sont déployés :

- `cert-manager` (pré-requis de l'OTel Operator),
- **OpenTelemetry Operator** + ressource `Instrumentation` Python,
- **OTel Collector** (namespace `observability`),
- **Tempo** (traces), **VictoriaMetrics** (metrics), **Grafana** (dashboards),
- les 6 services de l'app dans le namespace `workshop`.

## 5. Accéder à l'application

k3d embarque Traefik par défaut et l'expose sur le port hôte `8080` du load balancer. Un ingress route l'UI directement :

<http://localhost:8080>

Alternative par port-forward :

```bash
kubectl -n workshop port-forward svc/ui 3000:8080
```

App sur <http://localhost:3000>.

## 6. Accéder à Grafana

```bash
kubectl -n observability port-forward svc/grafana 3001:80
```

Grafana sur <http://localhost:3001>.

## 7. Nettoyer

```bash
task cluster:delete
```

Supprime le cluster **et** le registry, efface `kubeconfig.yaml`.

## Référence : toutes les tâches cluster

```bash
task --list
```

Voir [05-development.md](05-development.md) pour la liste complète.

## Troubleshooting

Voir [06-troubleshooting.md](06-troubleshooting.md) (ports déjà pris, image non trouvée par k3d, auto-instrumentation qui ne s'injecte pas…).
