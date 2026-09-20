// Demonstration only; no real customer data.
export function createExample() {
  const step = (id, label, x, y, ct, description) => ({ id, type: 'process', position: { x, y }, data: { label, description, subtype: 'standard', cycleTimes: { address: ct }, availableTime: 480 } });
  const link = (source, target, percentage, wait = 0) => ({ id: `${source}-${target}`, source, target, type: 'flow', markerEnd: { type: 'arrowclosed', color: '#67818f' }, data: { percentage, routingType: 'global', itemData: wait ? { address: { wait } } : {} } });
  return {
    title: 'Changement d’adresse · Exemple',
    nodes: [
      { id: 'start', type: 'startEnd', position: { x: 0, y: 150 }, data: { type: 'start', label: 'Demande client', description: '100 dossiers / jour', volumeItems: [{ id: 'address', name: 'Adresse', value: 100, color: '#91bbc8' }] } },
      step('receive', 'Qualifier la demande', 300, 130, 2, 'Vérifier les informations reçues'),
      step('check', 'Contrôler les justificatifs', 630, 130, 3, 'Conformité et validité des pièces'),
      step('standard', 'Valider le dossier', 980, 0, 1, 'Parcours standard · 80 %'),
      step('exception', 'Traiter l’exception', 980, 320, 12, 'Revue humaine · 20 %'),
      step('update', 'Mettre à jour le compte', 1350, 130, 2, 'Enregistrement dans le core banking'),
      { id: 'end', type: 'startEnd', position: { x: 1710, y: 150 }, data: { type: 'end', label: 'Client informé', description: 'Confirmation envoyée' } },
    ],
    edges: [link('start', 'receive', 100), link('receive', 'check', 100, 15), link('check', 'standard', 80), link('check', 'exception', 20, 60), link('standard', 'update', 100), link('exception', 'update', 100), link('update', 'end', 100)],
  };
}
