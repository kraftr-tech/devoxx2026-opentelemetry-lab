# Documentation — Atelier OpenTelemetry Devoxx FR 2026

Bienvenue dans la documentation de l'atelier. Cette page est le point d'entrée unique vers toutes les ressources.

## Je viens suivre le workshop

➡️ Commencer par [workshop/README.md](workshop/README.md) — vue d'ensemble des 6 états / 5 exercices, navigation entre les branches, pré-requis participants.

## Je veux juste essayer l'application

➡️ [01-getting-started.md](01-getting-started.md) — démarrer la stack en local avec Docker Compose.

## Références techniques

| Page | Contenu |
| --- | --- |
| [01-getting-started.md](01-getting-started.md) | Prérequis, démarrage Docker Compose, comptes de test |
| [02-architecture.md](02-architecture.md) | Architecture détaillée, ports, patterns de communication |
| [03-deployment-k3d.md](03-deployment-k3d.md) | Déploiement sur Kubernetes local (k3d) |
| [04-observability.md](04-observability.md) | Stack OTel : collecteur, export Grafana Cloud, signaux |
| [05-development.md](05-development.md) | Structure du code, Taskfile, dev d'un service seul |
| [06-troubleshooting.md](06-troubleshooting.md) | Erreurs fréquentes et comment les résoudre |

## Guide du workshop

| Page | Contenu |
| --- | --- |
| [workshop/README.md](workshop/README.md) | Vue d'ensemble des 6 étapes et navigation entre branches |
| [workshop/00-setup.md](workshop/00-setup.md) | Setup commun à faire avant le workshop |
| [workshop/step1-add-traces.md](workshop/step1-add-traces.md) | Exo 1 (sur `main`) : instrumentation des **traces** de `payment-service` (Flask + gRPC client, export console) |
| [workshop/step2-add-metrics.md](workshop/step2-add-metrics.md) | Exo 2 (sur `step-2-metrics`) : auto-instrumentation des **métriques** de `payment-service` |
| [workshop/step3-add-logs.md](workshop/step3-add-logs.md) | Exo 3 (sur `step-3-logs`) : **logs** — corrélation seule sur payment, bridge OTel complet sur products |
| [workshop/step4-add-collector.md](workshop/step4-add-collector.md) | Exo 4 (sur `step-4-collector`) : brancher le **collecteur** vers Grafana Cloud et tagger les signaux par étudiant |
