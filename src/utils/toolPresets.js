import { toolBrands, resolveToolBrand } from './toolBrands.js';
export const toolIcons = [
  ...toolBrands.map(b=>[b.id,b.label,'inherit']),
  ['spreadsheet','Tableur','var(--c-43c991)'], ['globe','Internet','var(--c-5bbcff)'],
  ['mail','Messagerie','var(--c-67a5ff)'], ['folder','Documents','var(--c-e9ba58)'],
  ['scan','OCR','var(--c-ba9bff)'], ['shield','Conformité','var(--c-f29a68)'],
  ['database','Base de données','var(--c-66d4cb)'], ['workflow','Automatisation','var(--c-ed8fb9)'],
  ['code','API','var(--c-9caeff)'], ['wrench','Outil','var(--c-a9bac5)'],
];
export const toolPresets = [
  ...toolBrands.map(({id, label, description, group, aliases}) => ({name:label,icon:id,description,group,aliases})),
  {name:'Internet',icon:'globe',group:'Génériques',description:'Recherche web et consultation de sources publiques'},
  {name:'OCR documentaire',icon:'scan',group:'Génériques',description:'Extraction des données des justificatifs'},
];
export const toolGroups = [...new Set(toolPresets.map(preset => preset.group))];
export function matchesToolQuery(tool, query = '') {
  const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const aliases = tool.aliases || resolveToolBrand(tool.icon, tool.name)?.aliases || [];
  const searchable = normalize([tool.name, tool.description, tool.group, ...aliases].join(' '));
  return words.every(word => searchable.includes(word));
}
export function filterToolPresets(query = '', group = '') {
  return toolPresets.filter(preset => (!group || preset.group === group) && matchesToolQuery(preset, query));
}
