import useStore from '../store/useStore';

const english = {
  'Projet':'Project', 'Réglages':'Settings', 'Affichage':'View', 'Atelier':'Workshop',
  'Espace de travail':'Workspace', 'Projets & historique':'Projects & history', 'Nouveau projet':'New project',
  'Ouvrir un fichier…':'Open a file…', 'Charger l’exemple KYC':'Load KYC example',
  'Exporter et partager':'Export & share', 'Enregistrer le fichier':'Save file', 'Enregistrer sous…':'Save as…',
  'Exporter le rapport PDF':'Export PDF report', 'Fermer le projet':'Close project', 'Télécharger PDF':'Download PDF',
  'Renommer le projet':'Rename project', 'Nom du projet':'Project name', 'Annuler':'Undo', 'Rétablir':'Redo',
  'Aligner':'Arrange', 'Vue globale':'Fit view', 'Afficher toute la carte':'Fit the entire map', 'Centrer l’étape':'Focus selected step',
  'Disposition':'Layout', 'Basculer l’orientation':'Switch orientation', 'Lecture verticale':'Vertical flow', 'Lecture horizontale':'Horizontal flow',
  'Mettre en évidence':'Highlight resources', 'Aucun focus':'No highlight', 'Outils':'Tools', 'Acteurs':'Actors', 'Équipes':'Teams',
  'Panneaux':'Panels', 'Palette':'Palette', 'Analyse':'Analysis', 'Inspecteur':'Inspector', 'Visible':'Visible', 'Repliée':'Collapsed', 'Replié':'Collapsed',
  'Niveau de détail':'Detail level', 'Vue d’ensemble':'Overview', 'Opérations':'Operations', 'Données détaillées':'Detailed data',
  'Langue des menus':'Menu language', 'Apparence':'Appearance', 'Sombre':'Dark', 'Clair':'Light',
  'Préférences enregistrées sur cet appareil.':'Preferences saved on this device.',
  'La langue concerne les menus de navigation. Les données de vos cartes restent dans leur langue d’origine.':'Language applies to navigation menus. Your map data stays in its original language.',
  'Enregistré':'Saved', 'Récupération…':'Recovering…', 'Modifications à enregistrer':'Unsaved changes', 'Sauvegarde en cours…':'Saving…',
  'Erreur de sauvegarde':'Save failed', 'Conflit entre onglets':'Tab conflict', 'Commandes de la carte':'Map controls',
  'Précédent':'Previous', 'Suivant':'Next', 'Quitter la présentation':'Exit presentation', 'Quitter la comparaison':'Exit comparison',
  'Chevauchement détecté · Réagencer':'Overlap detected · Rearrange', 'Verrouiller la position':'Lock position', 'Déverrouiller la position':'Unlock position',
  'Créer une copie de récupération':'Create recovery copy', 'Réessayer':'Retry', 'Actions en cours':'Active actions',
};
export default function useMenuLanguage() {
  const language = useStore(s => s.menuLanguage);
  return text => language === 'en' ? (english[text] || text) : text;
}
