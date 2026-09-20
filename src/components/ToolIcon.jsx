import { Sheet, Globe, Mail, Folder, ScanText, ShieldCheck, Database, Workflow, Code, Wrench } from 'lucide-react';
import { toolIcons } from '../utils/toolPresets';
const icons={spreadsheet:Sheet,globe:Globe,mail:Mail,folder:Folder,scan:ScanText,shield:ShieldCheck,database:Database,workflow:Workflow,code:Code,wrench:Wrench};
export default function ToolIcon({ name='wrench', size=22 }) {
  const Icon=icons[name] || Wrench;
  const color=toolIcons.find(i=>i[0]===name)?.[2] || '#a9bac5';
  return <span className="tool-icon" style={{color}}><Icon size={size}/></span>;
}
