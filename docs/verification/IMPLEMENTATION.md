# VSM Studio 3 — journal de réalisation

Recette du 15 octobre 2026. Base Git `a8905bdb642a3d9106016513db2fc8c11014bad9`, avec les changements de catalogue/logos déjà présents dans le répertoire. Le manifeste `source-manifest.json` identifie les sources livrées sans inclure les documents de travail privés.

## Résultat et périmètre de preuve

Les lots fonctionnels 0 à 11 sont implémentés. La recette intégrée locale couvre les imports, l’analyse, les scénarios, la simulation, les propositions, la réutilisation, la présentation, le partage et la récupération. Les preuves automatiques, navigateur, PDF et déploiement sont distinguées ci-dessous. Les réserves explicitement ouvertes ne sont pas présentées comme validées.

La publication a été faite en deux vagues : stockage/historique puis ensemble intégré. Les lots 2 à 11 ont des services et tests séparés, mais pas chacun une publication publique intermédiaire. La CI est livrée ; elle n’a pas été déclenchée sur GitHub, le code n’ayant pas été poussé durant cette réalisation. La publication open source et la licence restent inchangées.

## Livrables par lot

| Lot | Implémentation et preuve | État de recette |
| --- | --- | --- |
| 0 Référence | 38 tests initiaux passants, métriques legacy figées dans `baseline/results.json`, capture KYC, corpus de six fichiers ; workflow GitHub lint/tests/build. | Corpus ouvert dans le navigateur ; CI distante non exécutée. |
| 1 Stockage | IndexedDB, récupération, 50 autosauvegardes, versions nommées, restauration préservant l’état antérieur, annuler/rétablir, copie de récupération, migration des bibliothèques. | Tests quota/transaction interrompue/rétention ; deux vrais onglets testés avec conflit puis copie, les deux projets conservés. Version nommée et rechargement vérifiés localement, en préversion et en public pour la première vague. |
| 2 Hypothèses et calculs | Métadonnées de mesures, unités, statut, source/date/responsable/périmètre ; analytic-1 distinct du legacy-2. | Cas manuels 10 × 4 = 40, attente 5 et lead 9 ; catégories, moyennes, inconnus et capacités testés ; ancien corpus reproduit exactement. |
| 3 Placement | Dimensions DOM réelles, cartes incluant satellites, labels mesurés, espacement par colonnes, verrous, aperçu et annulation. Une seule courbe Bézier et étiquette à son milieu. | Corpus sans collisions ; verrous incompatibles refusés ; 200 étapes/500 liens ; KYC en navigateur : 21 cartes, 22 labels, zéro collision en préversion. |
| 4 Détail | Vue d’ensemble / Opérations / Données détaillées ; remesure ; proposition de réagencement en cas de collision ; inspecteur disponible. | Changement sans modification métier, thèmes clair/sombre, Escape, focus restitué et Tab confiné au dialogue vérifiés. |
| 5 Scénarios | Duplication indépendante, nommage, référence actuel, archivage, écarts et surbrillance des étapes/connexions et ressources concernées. | Copie identique sans écart ; actuel à 40 conservé après cible à 20 ; deux scénarios réimportés puis retrouvés après rechargement. |
| 6 Simulation | Volumes, cycles, attentes, effectifs, capacités, routages ; réinitialisation et enregistrement en cible. | KYC exploré : charge 5159,82 → 5019,82 en changeant un cycle ; source conservée. Routage non modifié des autres catégories préservé. |
| 7 Diagnostic | Charge et contribution, surcharge, attentes d’étapes/connexions, plus long parcours ; formules et ouverture de l’inspecteur. | Cas capacité zéro, affectations partagées, branches/convergences, inconnus, cycles et routages invalides testés. L’alerte surcharge 200 % ouvre le bon objet et la formule. |
| 8 Sous-processus | Modèles, ports, paramètres, catégories explicites, copie de ressources et provenance, nouveaux identifiants. | Insertion UI d’un modèle ; tests indépendance, références internes, remappage des unités et sources des connexions. Les ports externes sont raccordés explicitement par l’utilisateur. |
| 9 Revue et rapport | Commentaires ouverts/résolus et sélection PDF, références supprimées signalées, parcours ordonné, rapport paginé. | Commentaire et présentation exercés. PDF KYC 49 pages et rapport de texte long 9 pages générés ; pages de carte, détails avec vrai logo et texte long inspectées visuellement. Téléchargement natif non validé dans le navigateur intégré, voir réserve. |
| 10 Codex | Dossier minimal visible, contrat 1.0, validation stricte de révision/objets/champs, prévisualisation et cible avec provenance. | Proposition de référence importée, charge recalculée à 20, actuel à 40 inchangé ; refus du JSON malformé, objet/catégorie absents, code et révision périmée. |
| 11 Serveur local | Écoute 127.0.0.1, trois adaptateurs, .env.example, états configuré/absent, choix explicites, requête unique, limites et annulation. | Installation propre passant lint/71 tests/build ; réponses fournisseurs simulées pour refus, 429, délais, annulation, invalidité, concurrence. Configuration désactivée vérifiée sur 8787. Aucun appel payant réel réalisé. |
| 12 Recette intégrée | Guides utilisateur/installation/contrats, exemples v3 et proposition, fichier `roundtrip.vsm`, preuves et déploiements. | Parcours intégré exercé localement et contrôles préversion/public consignés ci-dessous ; réserves de recette conservées. |

## Tests et performances

- `npm run lint` : réussi.
- `npm test` : **71/71** réussis ; `tests-final.txt`.
- Copie propre, `npm ci`, lint, suite et build : réussis ; `clean-install-tests.txt`.
- `npm run build` : réussi ; avertissement non bloquant de chunk principal > 500 Ko ; `build-final.txt`.
- `npm audit` : zéro vulnérabilité signalée.
- Poste de mesure : Mac Apple M1 Pro, arm64, Node 22.16.0. Cas déterministe 200 étapes / 500 connexions : analyse ~2,45 ms, placement ~141 ms, accepté sans collisions. Ces chiffres caractérisent ce corpus, pas tous les graphes possibles.
- Les tests hérités restent présents ; aucun changement de formule historique pour faire passer la suite.

## Preuves visuelles et fichiers

- `baseline/kyc.png`, `baseline/results.json` : état initial.
- `lot1-local.png`, `lot1-preview.png`, `lot1-public.png` : première vague.
- `scenarios-local.png`, `overview-local.png`, `operations-light.png` : scénario, niveaux de détail et thème.
- `concurrent-conflict.png` : conflit réel entre deux onglets.
- `roundtrip.vsm` : fichier effectivement exporté depuis l’interface, réimporté et rouvert : deux scénarios, modèle, présentation, version nommée.
- `final-preview.png` : calculs analytiques du KYC en préversion.
- Rapports locaux : `output/pdf/kyc-recette.pdf` et `output/pdf/rapport-long-recette.pdf` (artefacts ignorés par Git).
- Rendus inspectés : `tmp/pdfs/kyc-map.png`, `kyc-logo-final.png`, `long-final.png`.

## Réserves de recette

1. Le navigateur intégré annule les téléchargements natifs, y compris via un lien Blob explicite. Les PDF sont générés et inspectés sur disque avec le même moteur ; leur téléchargement natif n’est pas déclaré validé. L’export VSM dispose d’une copie JSON de secours, utilisée pour vérifier l’aller-retour réel. Le dossier Downloads de ce poste est un lien symbolique dont la cible est absente ; aucun réglage personnel n’a été modifié.
2. Les trois fournisseurs ont été testés avec réponses simulées, sans envoyer de contenu ni engager de dépense. La compatibilité d’un modèle réel choisi par l’utilisateur reste à exercer dans son installation.
3. Le workflow CI existe et les mêmes commandes passent dans une copie propre, mais aucune exécution GitHub distante n’est revendiquée.
4. La recette UI et PDF porte sur les cas et pages indiqués, pas sur tous les navigateurs ni toutes les tailles de documents. Un graphe dont les contraintes ne permettent pas un placement valide reste intact avec diagnostic.

## Déploiements et retour arrière

- Première vague préversion : `dpl_DJVYxALsGP2k8koH2ywqTGg9R3yk`.
- Première vague publique : `dpl_82yzFZLeTg67pvGnRYm8Q8wbPYCg`.
- Préversion intégrée finale : `dpl_GaTDVcCVbq8o9L2rf2Ax1nBD2m8i`, https://vsm-9mp7xrjf4-herberadaniel-5440s-projects.vercel.app/.
- Cette préversion conserve un lecteur VSM 3 et constitue le point de retour compatible, avec ses sources identifiées dans `source-manifest.json`.

Avant un retour arrière, exporter le projet VSM 3 avec versions nommées. Réaffecter le domaine au déploiement compatible vérifié, ou redéployer le paquet source correspondant. Ne pas revenir à une version 2 pour ouvrir un fichier multi-scénarios : ses scénarios supplémentaires ne sont pas compris par l’ancien lecteur. IndexedDB reste lié à l’origine publique ; un changement d’URL vers une préversion exige un export/import pour retrouver les projets.

### Production finale et recette exercée

Déploiement production : `dpl_AAzamMVoukezNqisCFPmzZeRKnhc`, https://vsm-fypdpog4u-herberadaniel-5440s-projects.vercel.app/, alias https://vsm-mauve.vercel.app/.

Sur l’alias public après déploiement :
- import du fichier v3 de référence ;
- prévisualisation et acceptation de la proposition valide ;
- actuel 40 / cible 20, écart -20 ; les deux scénarios restent identiques après rechargement ; capture `scenarios-public.png` ;
- import du logo personnalisé, rechargement, image PNG embarquée retrouvée ;
- génération PDF aboutissant au lien de téléchargement préparé ;
- interface indiquant que les connecteurs personnels sont réservés à l’installation locale.

Le bundle servi par l’alias est comparé octet pour octet au build local dans `public-build.json`. La preuve de collisions KYC est celle de la préversion finale identique : 21 cartes, 22 étiquettes, zéro collision. Une répétition supplémentaire en production a été interrompue par le contrôle du dialogue natif du navigateur intégré ; ce contrôle supplémentaire n’est pas déclaré réussi. Les tests publics précédents restent acquis.
