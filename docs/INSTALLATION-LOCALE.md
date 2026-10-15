# Installation locale et connecteurs facultatifs

Node.js 22.22 ou ultérieur et npm sont requis. Depuis le répertoire du projet :

```sh
npm ci
npm run lint
npm test
npm run build
npm run local
```

Ouvrir http://127.0.0.1:8787. Le serveur écoute uniquement 127.0.0.1. La version Vercel demeure statique, sans accès aux clés d’une installation personnelle. Pour développer l’interface sans serveur IA : `npm run dev`.

## Configuration privée

Copier `.env.example` vers `.env` dans l’installation locale. Renseigner uniquement les fournisseurs souhaités et un modèle disponible dans son propre compte :

- `OPENAI_API_KEY`, `OPENAI_MODEL` ;
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` ;
- `GEMINI_API_KEY`, `GEMINI_MODEL`.

Les appels sont désactivés tant que `VSM_AI_ENABLED=false`. Choisir `true` pour autoriser l’installation, puis redémarrer le serveur. Dans l’atelier, cliquer **Diagnostiquer la configuration locale** : seul l’état configuré/absent et les noms de modèles sont affichés. Sélectionner un fournisseur et modèle, vérifier le dossier puis lancer explicitement l’analyse.

Les clés restent dans l’environnement serveur. Ne jamais utiliser un préfixe `VITE_` pour une clé. `.env` et ses variantes sont ignorés par Git ; seul `.env.example` est versionnable. Les clés ne sont pas ajoutées aux fichiers VSM, aux journaux ni au bundle. Les adaptateurs utilisent des URL fixes des fournisseurs, limitent la réponse à 4096 jetons et 2 Mo et appliquent un délai de 60 secondes. Une seule requête est admise à la fois. Annulation possible ; aucun échec ne déclenche une relance automatique.

La revue Codex par fichiers fonctionne sans clé API ni serveur local. Les tests des fournisseurs utilisent des réponses simulées et n’engagent aucune dépense. Un test réel doit être déclenché volontairement dans l’interface avec un fournisseur configuré.

Documentation primaire consultée pour les contrats HTTP :
- [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Claude Messages](https://platform.claude.com/docs/fr/api/http/messages/create)
- [Gemini Generate Content](https://ai.google.dev/api/generate-content)

## Maintenance

Les tests utilisent le moteur historique, le moteur analytique, un IndexedDB simulé pour les pannes déterministes et un serveur local avec fournisseurs simulés. La CI GitHub exécute lint, tests et build à chaque push ou pull request. Le déploiement web ne doit contenir que les sources applicatives, assets publics et fichiers de compilation ; jamais les `.env`, documents de travail ou rapports privés.

Le stockage du navigateur est propre à l’origine (URL et port). Un projet créé sur localhost n’apparaît pas automatiquement sur Vercel. Utiliser un fichier VSM pour le transférer.
