# Sous-processus imbriqués — contrôle visuel

final result: passed

## Référence et priorité

La première maquette acceptée (`exec-04a4dd29-721e-4abc-ac85-3afff8d1aa7e.png`) définit le comportement des cadres et du repli. L'instruction ultérieure de Daniel impose de conserver le look and feel actuel. Les cartes compactes, métriques redessinées et nouveaux styles de la maquette ne sont donc pas reproduits.

La maquette et les captures rendues ont été ouvertes ensemble lors de la comparaison. Contenu et viewport diffèrent : maquette 1488×1058, KYC réel 1600×1100, cas contrôlé 1440×1000 à densité 1. Le contrôle porte sur les cadres, commandes contextuelles et conservation du langage visuel, pas une égalité pixel à pixel de cartes différentes. Captures détaillées sombre/clair du groupe replié inspectées à taille lisible.

## Corrections et nouvelle vérification

- P1 : deux flux sortant du même groupe replié superposaient leurs étiquettes. Les ports sont maintenant espacés selon l'encombrement des étiquettes. Les quatre combinaisons de repli KYC sont testées sans collision. Les courbes restent des connexions normales, non déformées par un waypoint d'étiquette.
- P1 : le repli d'un très grand cadre pouvait placer sa carte hors écran. Cadrage du groupe après repli, zoom minimal adapté aux grandes cartes, retour au niveau supérieur vérifié.
- P2 : la barre de sélection empiétait sur une commande d'édition liée. Placée à gauche du canevas et sous le fil d'Ariane lorsqu'il est présent ; aucun bandeau supérieur permanent ajouté.

Après correction : `../verification/subprocesses-3.1/kyc-expanded.png`, `collapsed-dark.png`, `collapsed-light.png`. Aucune anomalie P0/P1/P2 restante sur ces états.

## Surfaces vérifiées

- Typographie : polices et hiérarchie de l'application existante. Titres des cadres tronqués proprement ; indicateurs et provenance accessibles dans l'inspecteur.
- Espacement : cadres englobant cartes, satellites et étiquettes internes, hiérarchie contenante volontaire. Déplacement collectif, repli/dépli et focus exercés.
- Couleurs : variables existantes sombre/clair, cadre neutre ; pas d'assimilation du groupe à un agent bleu. Rouge entrées/sorties, gris humain, vert IT et bleu agent inchangés.
- Images : vrais logos réutilisés via ToolIcon, sans nouveaux assets de substitution ; Excel visible dans la synthèse de contrôle.
- Contenu : libellés métiers conservés, synthèse distincte du graphe détaillé, valeurs inconnues explicites, ressources avec provenance et formule dans l'inspecteur.

## Vérification finale

- [x] Cadres ouverts et carte agrégée inspectés.
- [x] Thèmes clair/sombre contrôlés.
- [x] Cartes et menu existants conservés.
- [x] Actions contextuelles et fil d'Ariane fonctionnels.
- [x] Parcours Chrome et WebKit, erreurs d'exécution contrôlées.
- [x] Aucun changement de résultats métier dû au seul regroupement.
