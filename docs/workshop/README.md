# Workshop — Vue d'ensemble

Bienvenue dans l'atelier **OpenTelemetry — Instrumentation d'une stack microservices**, Devoxx FR 2026.

## Objectifs pédagogiques

À l'issue de l'atelier, tu seras capable de :

- Mettre en place l'**auto-instrumentation zero-code** (traces, métriques, logs) pour des services Python en Kubernetes via l'OpenTelemetry Operator.
- Déployer un **collecteur OTel** et configurer les pipelines receivers/processors/exporters.
- Ajouter des **spans custom** pour enrichir la télémétrie métier.
- Visualiser et corréler les 3 signaux dans Grafana.

## Format

- Durée : 3 h (format hands-on Devoxx).
- Prérequis : connaissances Python et Docker de base. Kubernetes n'est pas nécessaire, on utilise `k3d` en local.
- Support : slides + ce repo.

## Comment le workshop est organisé

Le repo est structuré autour de **6 branches git** représentant 6 états successifs de l'application, pour **5 exercices**. On part de `main` (projet non instrumenté) et chaque branche intermédiaire porte le nom de l'exercice qu'on y réalise (`step-N-<topic>`). À l'intérieur d'une branche, on réalise l'exercice qui amène l'état de la branche suivante. La dernière branche (`final-state`) représente l'état final, sans exercice associé.

| Branche | État de départ | Exercice sur cette branche |
| --- | --- | --- |
| `main` | Applications non instrumentées | Instrumenter les **traces** du `payment-service` (Flask + gRPC client, export console) |
| `step-2-metrics` | Tous les services Python instrumentés pour les traces | Instrumenter les **métriques** du `payment-service` |
| `step-3-logs` | + métriques partout | Instrumenter les **logs** |
| `step-4-collector` | + logs partout | Déployer et brancher le **collecteur OTel** |
| `step-5-custom-metrics` | + collecteur en place | **Instrumentation custom** du `payment-service` (spans manuels, attributs métier) |
| `final-state` | Stack instrumentée de bout en bout | — |

Chaque branche contient son propre guide d'exercice dans `docs/workshop/step-NN-*.md`.

## Navigation entre les étapes

```bash
# Étape courante
git branch --show-current

# Passer à l'étape suivante (la solution de ton exo + le guide du suivant)
git checkout step-2-metrics
```

> Les **ressources partagées** (schéma, setup, références techniques) sont identiques sur toutes les branches. Seul `docs/workshop/step-NN-*.md` change.

## Avant de commencer

1. Lire [00-setup.md](00-setup.md) — installation des outils et vérifications.
2. Récupérer tes credentials Grafana Cloud (fournis en début d'atelier).
3. Ouvrir le guide de l'étape courante : [step1-add-traces.md](step1-add-traces.md) (ou l'étape suivante selon ta branche).

## Ressources

- [docs/02-architecture.md](../02-architecture.md) — schéma et ports
- [docs/03-deployment-k3d.md](../03-deployment-k3d.md) — déploiement k3d
- [docs/04-observability.md](../04-observability.md) — pipeline OTel
- [docs/06-troubleshooting.md](../06-troubleshooting.md) — erreurs fréquentes
