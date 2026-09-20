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

Installation, compilation et affichage initial vérifiés le 20 septembre 2026. Le lint relève 18 erreurs héritées et npm signale 18 vulnérabilités dans les dépendances. Les fonctions métier et l'import/export restent à valider.

Voir [le diagnostic et le plan de reprise](docs/REPRISE.md).

Sur ce Mac, Git fonctionne avec `DEVELOPER_DIR=/Library/Developer/CommandLineTools git ...` si le Git par défaut est bloqué par la licence Xcode. Aucun changement système nécessaire.

## Première version graphique

`npm run lint`, `npm test` et `npm run build` passent. Utiliser **Exemple** pour charger le processus bancaire, **Aligner** pour ordonner les étapes de gauche à droite, et les boutons de panneaux pour ajuster l’espace. La sélection ouvre l’inspecteur. Les formules métier restent inchangées. Sauvegarder via File > Save ; la sauvegarde automatique reste à implémenter.

Version locale uniquement : aucun déploiement Vercel effectué. Les vulnérabilités des dépendances et l’avertissement de taille du bundle restent à traiter.
