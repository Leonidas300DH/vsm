# VSM v2

Reprise locale de [Leonidas300DH/vsm](https://github.com/Leonidas300DH/vsm).
Première refonte graphique sur la branche `reprise/v2` : thème sombre, canevas horizontal et exemple bancaire. La version héritée reste accessible dans l’historique Git.

## Démarrage

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Ouvrir l'adresse affichée par Vite. `npm run build` compile l'application, `npm run lint` contrôle le code.

## État initial

Installation, compilation et affichage initial vérifiés le 20 septembre 2026. À la reprise, le lint relevait 18 erreurs héritées et npm signalait 18 vulnérabilités ; après remédiation le même jour, le lint est propre et `npm audit` ne signale plus aucune vulnérabilité (jspdf migré en version 4).

Voir [le diagnostic et le plan de reprise](docs/REPRISE.md).

## Première version graphique

`npm run lint`, `npm test` et `npm run build` passent. Utiliser **Exemple** pour charger le processus bancaire, **Aligner** pour réappliquer la disposition, **Horizontal / Vertical** pour changer le sens de lecture, et **Focus** pour mettre en évidence toutes les étapes qui utilisent un outil, un acteur interne ou une équipe externe (le reste de la carte est estompé, la disposition ne change pas). La palette et l’analyse sont masquées au démarrage ; les boutons de la barre les affichent. En horizontal, outils, acteurs et connaissances sont affichés sous chaque carte et le bouton « + » (étape suivante) est à droite ; en vertical, les ressources passent à droite de la carte et le « + » dessous. La corbeille sur une carte supprime l’étape après confirmation ; un bandeau « Annuler » permet de la restaurer avec ses connexions, y compris après une suppression au clavier. La sélection ouvre l’inspecteur. Les formules métier restent inchangées. Sauvegarder via File > Save ; la sauvegarde automatique reste à implémenter.

Déployé sur Vercel (projet `vsm`) : production sur https://vsm-mauve.vercel.app, préversions automatiques par commit sur `main`. Déploiement depuis le commit GitHub, pas depuis l'arbre de travail local.

## Remédiation du 20 septembre 2026

Moteur de calcul fiabilisé (entrées non modifiées, arêtes orphelines et boucles signalées, champs vides à 0), recalcul à la suppression d’une étape, validation des fichiers `.vsm` à l’ouverture (format `2.0`, anciens fichiers acceptés), dépendances mises à jour et bibliothèques PDF chargées à la demande (chunk principal réduit de 1 041 kB à 451 kB). 22 tests via `npm test`. Détail dans `docs/REPRISE.md`.
