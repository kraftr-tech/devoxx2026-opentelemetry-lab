# UI — Atelier

Frontend de l'application e-commerce **Atelier**, utilisée dans le workshop OpenTelemetry Devoxx FR 2026.

Stack : React 19, Vite, Tailwind CSS, React Router, Lucide.

Voir le [README racine](../README.md) et la [documentation complète](../docs/README.md) pour l'architecture et le déploiement de l'ensemble de la stack.

## Prérequis

- Node.js (installé via [mise](https://mise.jdx.dev) — voir [mise.toml](../mise.toml))

## Lancement en local

```bash
npm install
npm run dev
```

L'application est servie sur <http://localhost:3000>.

## Variables d'environnement

Créer un fichier `.env.local` si besoin :

| Variable               | Défaut                          | Description                                                  |
| ---------------------- | ------------------------------- | ------------------------------------------------------------ |
| `GEMINI_API_KEY`       | —                               | Clé API Gemini (assistant produit)                           |
| `PRODUCTS_SERVICE_URL` | `http://products-service:8002`  | Cible du proxy `/api/products`                               |
| `USERS_SERVICE_URL`    | `http://users-service:8001`     | Cible du proxy `/api/users`                                  |
| `PAYMENT_SERVICE_URL`  | `http://payment-service:8003`   | Cible du proxy `/api/payments`                               |
| `BILLING_SERVICE_URL`  | `http://billing-service:8004`   | Cible du proxy `/api/billing`                                |
| `DISABLE_HMR`          | `false`                         | Désactive le HMR (utile en conteneur)                        |

Le proxy Vite est configuré dans [vite.config.ts](vite.config.ts).

## Scripts

| Commande          | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Serveur de dev sur le port 3000          |
| `npm run build`   | Build de production (`dist/`)            |
| `npm run preview` | Prévisualise le build                    |
| `npm run lint`    | Vérification TypeScript (`tsc --noEmit`) |
| `npm run clean`   | Supprime `dist/`                         |

## Déploiement

- **Docker Compose** : `docker compose up ui` (depuis la racine)
- **Kubernetes (Kind)** : voir les tâches `task build:ui` et `task cluster:load` dans [Taskfile.yaml](../Taskfile.yaml)
