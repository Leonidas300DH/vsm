# Recette des sous-processus VSM 3.1

## Périmètre livré

Hiérarchie indépendante du graphe métier, cadres imbriqués, sélection multiple connectée, dissociation, suppression avec aperçu, déplacement collectif, repli avec ports de frontière distincts, navigation par niveau et inspecteur. Les cartes existantes, couleurs, ressources satellites et courbes sont conservées.

Brouillons de décomposition explicites, sauvegarde confirmée par IndexedDB, réutilisation des documents de référence, comparaison des ressources et volumes aux frontières, acceptation des indicateurs inconnus et activation atomique avec référence conservée. Annuler/rétablir restaure le graphe et la hiérarchie. Les brouillons restent locaux au scénario ; l'activation structurelle suit l'aperçu de l'édition liée.

Les fichiers VSM 3.1 incluent le graphe détaillé, les groupes, les références et les brouillons. Les modèles réutilisables remappent leurs identifiants et ressources. Comparaisons, commentaires, présentation, PDF et dossier d'analyse connaissent les groupes.

## Vérifications locales

- 119 tests, dont 20 nouveaux tests de hiérarchie : cinq niveaux, branches/convergence, frontières multiples, boucles et données inconnues, intégrité du modèle, ressources partagées, portabilité, modèles, scénarios liés et indépendants, transactions annuler/rétablir.
- Lint et compilation réussis. Avertissement Vite conservé : chunk principal supérieur à 500 kB.
- Pièces jointes : stockage des octets compatible avec WebKit, lecture rétrocompatible des anciens enregistrements Blob ; import, rattachement explicite au détail, sauvegarde et réouverture vérifiés.
- Google Chrome et WebKit : regroupement, repli/dépli, renommage, navigation, dissociation, sauvegarde/réouverture du brouillon, activation et annulation/rétablissement. Aucun message d'erreur d'exécution.
- Chrome et WebKit : KYC imbriqué, export PDF, export VSM 3.1, propagation vers deux enfants, modification locale d'un enfant délié, annulation/rétablissement.
- Chrome : suppression avec aperçu et restauration ; déplacement collectif ; thèmes sombre/clair. Les 17 contrôles préexistants de l'édition liée passent aussi, sans erreur ni avertissement de console.
- PDF KYC de 52 pages : pages de hiérarchie 11–12 rendues et inspectées, tableaux lisibles, ressources et provenance présentes. Le PDF garde la carte détaillée et ajoute les synthèses ; il ne reproduit pas l'état local de repli.
- Apple M1 Pro, macOS arm64, Node local : 200 étapes, 500 connexions, cinq niveaux ; calcul ~4 ms, projection/synthèses ~4 ms, réagencement ~141 ms. Mesure du moteur, pas un engagement de fluidité sur tous les appareils.

Les fichiers JSON et captures du dossier enregistrent les parcours et les résultats. Les captures proviennent de contextes navigateur isolés ; les données personnelles de l'utilisateur n'ont pas été modifiées.

## Rejouer les parcours navigateur

Installer Playwright et ses navigateurs dans l'environnement de test, puis lancer `npm run build` et `npm run preview -- --host 127.0.0.1 --port 4174`. Les scripts utilisent Chrome installé et WebKit Playwright.

```
QA_URL=http://127.0.0.1:4174/ node tests/browser/groups.mjs
QA_URL=http://127.0.0.1:4174/ QA_BROWSER=webkit node tests/browser/groups.mjs
QA_URL=http://127.0.0.1:4174/ node tests/browser/groups-integration.mjs
QA_URL=http://127.0.0.1:4174/ QA_BROWSER=webkit node tests/browser/groups-integration.mjs
```

`PLAYWRIGHT_MODULE` peut pointer vers un runtime Playwright déjà installé. Les scripts écrivent leurs preuves temporaires dans `/tmp/vsm-groups-*`. Les validations Chrome/WebKit ont utilisé le runtime Codex disponible, le plugin Browser n'étant pas fourni dans cette session.

## Comportements délibérés

- Replier est un choix local d'affichage, jamais une modification des calculs ou une propagation aux enfants.
- Les positions détaillées sont conservées ; une grande carte peut demander zoom ou ouverture d'un niveau. Le cadrage supporte les grands graphes.
- Un placement impossible avec des positions verrouillées est refusé. Une vue produisant encore des collisions fournit un diagnostic au lieu de déplacer silencieusement les étapes.
- Les volumes aux frontières sont des passages, pas une déduplication de dossiers. Les cycles restent représentables mais leurs délais ne sont pas inventés.
- Le brouillon est enregistré par une commande explicite ; sa fermeture demande confirmation s'il reste des changements non enregistrés.

## Publication et retour arrière

Le journal `publication.json` consigne le commit, la CI et les URL vérifiées après publication. La publication part d'une archive Git propre, sans les documents personnels non suivis du répertoire de travail.

Retour arrière disponible : déploiement `dpl_GDcx5x3bBgU9Vm9U7co8gUFuuo9e`, URL `https://vsm-4o0iixwyz-herberadaniel-5440s-projects.vercel.app`, code `0b7fedb08a60a398bd07b27760e4cf9eb83dd20c`. Exporter d'abord les projets 3.1 : l'ancienne interface n'affiche pas les groupes ; le graphe détaillé reste présent dans le fichier. Conserver les sauvegardes 3.1 pour revenir à l'interface hiérarchique.
