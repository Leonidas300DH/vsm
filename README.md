# VSM Studio 3

Éditeur de value streams, local et sans compte. La carte horizontale relie étapes humaines, équipes externes, systèmes et agents, avec leurs outils, acteurs, connaissances et documents.

**Application : [vsm-mauve.vercel.app](https://vsm-mauve.vercel.app/)**

## Démarrer

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Pour une installation avec serveur IA facultatif :

```sh
npm run build
npm run local
```

Ouvrir http://127.0.0.1:8787. Les appels fournisseurs sont désactivés par défaut. Le fonctionnement par fichiers et la revue Codex ne nécessitent aucune clé.

## Fonctions

- Sauvegarde IndexedDB, récupération, historique nommé, annuler/rétablir et protection contre les conflits entre onglets.
- Format portable VSM 3, migration des anciens fichiers et conservation des champs métier, bibliothèques, logos et documents disponibles.
- Moteur historique conservé ; analyse distincte des charges, temps par dossier, attentes, capacités et lead times.
- Placement mesuré avec aperçu, positions verrouillées et trois niveaux de détail.
- Scénarios actuel/cible, comparaison, simulation exploratoire et diagnostics.
- Sous-processus copiables, commentaires, présentation ordonnée et rapports PDF paginés.
- Dossiers d’analyse Codex, propositions validées et adaptateurs locaux OpenAI, Claude et Gemini.
- Deux styles au choix dans Réglages → Style : Classique (par défaut) ou Signal Glass (`src/signal-glass.css`), chacun en sombre et en clair.

## Documentation et vérification

- [Guide utilisateur](docs/UTILISATION-V3.md)
- [Installation locale et clés](docs/INSTALLATION-LOCALE.md)
- [Format, calculs et contrat de propositions](docs/FORMAT-CALCULS.md)
- [Journal de livraison et limites de recette](docs/verification/IMPLEMENTATION.md)
- [Diagnostic de reprise initial](docs/REPRISE.md)

```sh
npm run lint
npm test
npm run build
npm audit
```

La CI reprend lint, tests et compilation. Les exemples de référence se trouvent dans `tests/fixtures`. Une compilation réussie ne remplace pas les recettes navigateur et PDF décrites dans le journal.

Le dépôt et l’historique d’origine sont conservés. Aucun changement de licence n’est introduit par cette évolution.
