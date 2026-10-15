import { Sheet, Globe, Mail, Folder, ScanText, ShieldCheck, Database, Workflow, Code, Wrench } from 'lucide-react';
import { isCustomLogo } from '../utils/customLogo';
import { resolveToolBrand } from '../utils/toolBrands';
import { toolIcons } from '../utils/toolPresets';
const icons={spreadsheet:Sheet,globe:Globe,mail:Mail,folder:Folder,scan:ScanText,shield:ShieldCheck,database:Database,workflow:Workflow,code:Code,wrench:Wrench};
export default function ToolIcon({ name='wrench', toolName='', logo, size=22 }) {
  if (isCustomLogo(logo)) return <span className="tool-icon tool-custom-icon"><img src={logo} alt={`Logo ${toolName || 'personnalisé'}`} width={size} height={size} style={{objectFit:'contain',display:'block'}}/></span>;
  const brand=resolveToolBrand(name,toolName);
  if (brand) return <span className="tool-icon tool-brand-icon"><img className={brand.darkFile ? 'brand-on-light' : undefined} src={`/tool-logos/${brand.file}`} alt={`Logo ${brand.label}`} width={size} height={size} style={{objectFit:'contain',display:'block'}}/>{brand.darkFile && <img className="brand-on-dark" src={`/tool-logos/${brand.darkFile}`} alt={`Logo ${brand.label}`} width={size} height={size} style={{objectFit:'contain',display:'block'}}/>}</span>;
  const Icon=icons[name] || Wrench;
  const color=toolIcons.find(i=>i[0]===name)?.[2] || 'var(--c-a9bac5)';
  return <span className="tool-icon" style={{color}}><Icon size={size}/></span>;
}
