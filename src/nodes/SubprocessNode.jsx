import { useContext, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "reactflow";
import { Layers, ChevronUp, Maximize2, MoreHorizontal } from "lucide-react";
import { GroupUIContext } from "../store/groupContext";
import ProcessNode from "./ProcessNode";

export default function SubprocessNode({ id, data, selected }) {
  const ui = useContext(GroupUIContext);
  const update = useUpdateNodeInternals();
  useEffect(() => {
    update(id);
  }, [id, data.collapsed, data.inputs.length, data.outputs.length, update]);
  const summary = ui.summaries?.get(id);
  if (data.collapsed && summary) {
    const resources = Object.fromEntries(Object.entries({tools: "toolsUsed", actors: "actorsUsed", knowledge: "knowledgeUsed"}).map(([kind, field]) => [field, summary.resources[kind].map(r => r.id)]));
    return <ProcessNode id={id} selected={selected} aggregate={summary}
      data={{...resources, label:data.group.name, subtype:"standard", cardHeight:data.cardHeight}}
      onOpenDetail={() => ui.focus(id)}
      ports={<>{["in", "out"].flatMap(side => (side === "in" ? data.inputs : data.outputs).map(edge => <Handle
        key={`${side}:${edge.id}`} id={`${side}:${edge.id}`} type={side === "in" ? "target" : "source"}
        position={side === "in" ? Position.Left : Position.Right}
        title={`${side === "in" ? "Entrée" : "Sortie"} · ${edge.id}`}
        style={{top:data.portOffsets[`${side}:${edge.id}`]}}
      />))}
      <Handle id="new-in" type="target" position={Position.Left} style={{top:"auto",bottom:14}} title="Nouvelle entrée : choisir une sous-étape"/>
      <Handle id="new-out" type="source" position={Position.Right} style={{top:"auto",bottom:14}} title="Nouvelle sortie : choisir une sous-étape"/>
      </>}
    />;
  }
  return <div className={`subprocess-node is-expanded ${selected ? "is-selected" : ""}`}>
    <header>
      <Layers size={16}/><strong>{data.group.name}</strong><span>{data.leafIds.length} étapes</span>
      <button className="nodrag" aria-label={`Replier ${data.group.name}`} onClick={e => {e.stopPropagation();ui.toggle(id);}}><ChevronUp size={14}/>Vue synthèse</button>
      <button className="nodrag" title="Ouvrir le détail" aria-label={`Ouvrir le détail ${data.group.name}`} onClick={e => {e.stopPropagation();ui.focus(id);}}><Maximize2 size={14}/></button>
      <button className="nodrag" aria-label={`Inspecter ${data.group.name}`} onClick={e => {e.stopPropagation();ui.inspect(id);}}><MoreHorizontal size={16}/></button>
    </header>
  </div>;
}
