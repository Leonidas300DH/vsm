// Illustrative KYC workflow only. All identities, volumes, decisions and durations are fictional.
// Explicit executed steps; supporting resources are references, never volume-carrying edges.
export function createExample() {
  const items = [{ id: 'retail', name: 'Particuliers', value: 70, color: '#8fbfd1' }, { id: 'business', name: 'Entreprises', value: 30, color: '#d5b375' }];
  const step = (id, label, subtype, x, y, retail, business, description, extra = {}) => ({ id, type: 'process', position: { x, y }, data: { label, subtype, executionMode: 'step', description, toolsUsed: ['kyc-case'], actorsUsed: subtype === 'standard' ? ['kyc-analyst'] : subtype === 'actor' ? ['kyc-compliance'] : [], knowledgeUsed: ['kyc-policy'], cycleTimes: { retail, business }, availableTime: 480, ...extra } });
  const edge = (source, target, routing = {}, itemData = {}) => ({ id: `${source}-${target}`, source, target, type: 'flow', markerEnd: { type: 'arrowclosed', color: '#67818f' }, data: { routingType: 'global', percentage: 100, ...routing, itemData } });
  const split = (retail, business) => ({ routingType: 'item', itemRouting: { retail, business } });
  const end = (id, label, y, description) => ({ id, type: 'startEnd', position: { x: 4800, y }, data: { type: 'end', label, description } });
  return {
    title: 'KYC · Entrée en relation & vigilance renforcée',
    tools: [
      {id:'kyc-web',name:'Internet',icon:'globe',description:'Recherche de sociétés, registres publics et sources ouvertes'},
      {id:'kyc-mail',name:'Outlook',icon:'mail',description:'Échanges client et demandes de justificatifs'},
      {id:'kyc-docs',name:'SharePoint',icon:'folder',description:'Dossier documentaire et archivage des preuves'},
      {id:'kyc-auto',name:'Power Automate',icon:'workflow',description:'Notifications et orchestration des tâches'},
      { id:'kyc-case', name:'Excel', icon:'spreadsheet', description:'Rapprochements, grille de contrôle et suivi des dossiers' },
      { id:'kyc-ocr', name:'OCR documentaire', icon:'scan', description:'Extraction et rapprochement des pièces' },
      { id:'kyc-screening', name:'World-Check · screening', icon:'shield', description:'Recherche PEP et sanctions' },
      { id:'kyc-core', name:'Core Banking', icon:'database', description:'Référentiel client' },
    ],
    actors: [
      { id:'kyc-analyst', name:'Analyste KYC', team:'Entrée en relation', scope:'internal', description:'Collecte et vérification du dossier' },
      { id:'kyc-compliance', name:'Responsable conformité', team:'Conformité', scope:'external', description:'Revue et arbitrage des dossiers sensibles' },
    ],
    knowledge: [
      { id:'kyc-policy', name:'Politique KYC', description:'Procédure illustrative d’entrée en relation' },
      { id:'kyc-risk', name:'Matrice des risques', description:'Critères illustratifs de vigilance renforcée' },
      { id:'kyc-evidence', name:'Référentiel des pièces', description:'Pièces attendues et contrôles de cohérence' },
    ],
    nodes: [
      { id: 'start', type: 'startEnd', position: { x: 0, y: 0 }, data: { type: 'start', label: 'Dossiers KYC entrants', description: '100 dossiers/jour · Données fictives', volumeItems: items } },
      step('intake','Collecter les pièces','standard',380,0,4,8,'Identité, adresse, activité et pièces société',{toolsUsed:['kyc-docs']}),
      step('extract','AI · Extraire & rapprocher','ai',760,0,.5,1.5,'Extraction documentaire et incohérences à vérifier',{ toolsUsed:['kyc-ocr'], knowledgeUsed:['kyc-evidence'] }),
      step('complete','Contrôler la complétude','standard',1140,0,2,4,'Séparer les dossiers complets et incomplets'),
      step('request','Demander les compléments','standard',1520,350,5,10,'Demande ciblée de pièces manquantes',{toolsUsed:['kyc-mail']}),
      step('recheck','Vérifier les compléments','standard',1900,350,3,6,'Réintégration après contrôle documentaire'),
      step('screen','AI · Préparer le screening','ai',2280,0,1,3,'Rapprochements PEP, sanctions et homonymes à examiner'),
      step('risk','Qualifier le risque','standard',2660,0,5,12,'Routage illustratif validé par un analyste',{ knowledgeUsed:['kyc-risk'],toolsUsed:['kyc-case','kyc-web'] }),
      step('standard','Vigilance standard','standard',3040,-350,6,15,'Revue proportionnée au profil de risque'),
      step('enhanced','Vigilance renforcée','actor',3040,250,25,60,'Origine des fonds, structure et bénéficiaires effectifs',{toolsUsed:['kyc-web','kyc-case']}),
      step('synthesis','AI · Synthèse de preuves','ai',3420,250,2,5,'Synthèse sourcée ; aucune décision automatique'),
      step('decision','Décision de conformité','standard',3800,0,4,10,'Décision humaine : accepter ou refuser'),
      step('activate','Activer la relation','standard',4180,-150,3,8,'Enregistrement du dossier accepté et plan de revue'),
      step('notify','Notifier & clôturer','standard',4180,350,3,5,'Traitement du refus selon la procédure interne'),
      step('archive','Constituer la piste d’audit','standard',4560,-150,2,4,'Décision, justificatifs et échéance de revue',{toolsUsed:['kyc-docs','kyc-auto']}),
      end('end','Relation activée',-150,'Dossier archivé · Revue planifiée'),
      end('rejected','Relation refusée',500,'Décision documentée'),
      // Systems and external teams execute steps on the main path.
      step('portal','Portail documentaire','it',760,0,.2,.5,'Dépôt et contrôle technique des pièces',{ wait_time: 2, toolsUsed:['kyc-ocr'] }),
      step('provider','Connecteur de screening','it',2660,0,.3,.6,'Requêtes vers les référentiels et journalisation',{ wait_time: 3, toolsUsed:['kyc-screening'], knowledgeUsed:['kyc-risk'] }),
      step('core','API Core Banking','it',4560,0,.2,.4,'Synchronisation du référentiel client',{ wait_time: 1, toolsUsed:['kyc-core'] }),
      step('officer','Arbitrer le dossier sensible','actor',3800,250,5,15,'Appui humain aux dossiers sensibles',{ wait_time: 30 }),
    ],
    edges: [
      edge('start','intake'), edge('intake','portal'), edge('portal','extract'), edge('extract','complete'),
      edge('complete','screen',split(85,70)),
      edge('complete','request',split(15,30),{ retail:{wait:120,painPoint:'Justificatif illisible'},business:{wait:480,painPoint:'Pièces de bénéficiaires effectifs manquantes'} }),
      edge('request','recheck'),edge('recheck','screen'),edge('screen','provider'),edge('provider','risk'),
      edge('risk','standard',split(90,60)),edge('risk','enhanced',split(10,40),{business:{wait:240,inventory:'Dossiers en revue renforcée',painPoint:'Structure de détention complexe'}}),
      edge('enhanced','officer'),edge('officer','synthesis'),edge('synthesis','decision'),edge('standard','decision'),
      edge('decision','activate',split(98,95)),edge('decision','notify',split(2,5)),edge('activate','core'),edge('core','archive'),edge('archive','end'),edge('notify','rejected'),
    ],
  };
}
