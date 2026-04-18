# Développement

Guide pour contribuer au projet ou développer un service isolément.

## Outils

Toutes les versions d'outils sont pilotées par [mise.toml](../mise.toml) :

- `go` 1.25 — bank-service
- `node` 24 — UI
- `protoc` 25.9 + plugins Go — stubs gRPC
- `task` — runner (cf. [Taskfile.yaml](../Taskfile.yaml))
- `k3d`, `kubectl`, `kustomize` — déploiement local
- `k6` — tests de charge

```bash
mise install
```

## Tâches disponibles

```bash
task --list
```

### Stack locale (Docker Compose)

| Tâche              | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `task stack:up`    | `docker compose up -d --build` avec env mise injecté       |
| `task stack:down`  | `docker compose down -v` (supprime les volumes)            |
| `task stack:logs`  | `docker compose logs -f otel-collector` (ou autre via CLI) |

### Build des images

| Tâche                          | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `task build`                   | Build toutes les images (taggées pour le registry k3d) |
| `task build:<service>`         | Build une seule image (`ui`, `users-service`, …)       |

### Cluster k3d

| Tâche                  | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `task cluster:create`  | Crée le registry + le cluster k3d `workshop`      |
| `task cluster:init`    | Installe le Flux Operator                         |
| `task cluster:load`    | Push les images dans le registry du cluster       |
| `task cluster:apply`   | Applique les manifests (substitue les creds GC)   |
| `task cluster:delete`  | Supprime cluster et registry                      |

### Divers

| Tâche                         | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `task proto:bank`             | Régénère les stubs Go de bank-service         |
| `task load:client-journey`    | Lance le scénario k6 (login→panier→checkout)  |

## Structure du code

Cf. [02-architecture.md](02-architecture.md#structure-du-code-par-service) pour le layout en couches.

## Développer un service Python seul

```bash
cd users-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py          # Flask dev server, pas gunicorn
```

Le service écoute sur son port natif (8001 pour `users`, etc.). Les autres services appelés doivent tourner en parallèle (via `task stack:up -- <service>`) ou être mockés.

## Développer l'UI seule

Voir [ui/README.md](../ui/README.md) — `npm install && npm run dev`, proxy Vite configurable via `.env.local`.

## Régénérer les stubs gRPC

Modifications du contrat dans [proto/transaction.proto](../proto/transaction.proto) :

```bash
task proto:bank
```

Les stubs Python de `payment-service` sont régénérés automatiquement au build Docker (voir [payment-service/Dockerfile](../payment-service/Dockerfile)).

## Tests de charge

Voir [k6/README.md](../k6/README.md).

## Conventions

- Les services Python tournent **toujours** avec gunicorn en prod (jamais le dev server Flask).
- Tous les services Python utilisent SQLite avec volume persistant.
- Les ports Kubernetes sont **tous 8080** côté Service ; le `targetPort` pointe vers le port natif du conteneur.
