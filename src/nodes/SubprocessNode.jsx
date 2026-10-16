import { useContext, useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "reactflow";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Maximize2,
  MoreHorizontal,
} from "lucide-react";
import { GroupUIContext } from "../store/groupContext";
import { displayNumber as fmt } from "../services/analysis";
import ToolIcon from "../components/ToolIcon";
export default function SubprocessNode({ id, data, selected }) {
  const ui = useContext(GroupUIContext),
    update = useUpdateNodeInternals();
  useEffect(() => {
    update(id);
  }, [id, data.collapsed, data.inputs.length, data.outputs.length, update]);
  const summary = ui.summaries?.get(id),
    total = (rows) =>
      rows?.some((r) => r.volume === null)
        ? null
        : rows?.reduce((s, r) => s + r.volume, 0);
  return (
    <div
      className={`subprocess-node ${data.collapsed ? "is-collapsed" : "is-expanded"} ${selected ? "is-selected" : ""}`}
    >
      <header>
        <Layers size={16} />
        <strong>{data.group.name}</strong>
        <span>{data.leafIds.length} étapes</span>
        <button
          className="nodrag"
          title={data.collapsed ? "Déplier le groupe" : "Replier le groupe"}
          aria-label={`${data.collapsed ? "Déplier" : "Replier"} ${data.group.name}`}
          onClick={(e) => {
            e.stopPropagation();
            ui.toggle(id);
          }}
        >
          {data.collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>
        <button
          className="nodrag"
          title="Ouvrir le détail"
          aria-label={`Ouvrir le détail ${data.group.name}`}
          onClick={(e) => {
            e.stopPropagation();
            ui.focus(id);
          }}
        >
          <Maximize2 size={14} />
        </button>
        <button
          className="nodrag"
          aria-label={`Inspecter ${data.group.name}`}
          onClick={(e) => {
            e.stopPropagation();
            ui.inspect(id);
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </header>
      {data.collapsed && (
        <div className="subprocess-summary">
          <small>Synthèse calculée · flux aux frontières</small>
          <dl>
            <dt>Entrées / sorties</dt>
            <dd>
              {fmt(total(summary?.inputs))} / {fmt(total(summary?.outputs))}
            </dd>
            <dt>Charge</dt>
            <dd>{fmt(summary?.workload)} min</dd>
            <dt>Processing / dossier</dt>
            <dd>{fmt(summary?.processing)} min</dd>
            <dt>Attente / dossier</dt>
            <dd>{fmt(summary?.waiting)} min</dd>
            <dt>Lead time / dossier</dt>
            <dd>{fmt(summary?.lead)} min</dd>
          </dl>
          <div className="subprocess-tools">
            {summary?.resources.tools.slice(0, 3).map((r) => (
              <span
                key={r.id}
                title={`${r.name} · ${r.usedBy.map((n) => n.name).join(", ")}`}
              >
                <ToolIcon
                  name={r.icon}
                  toolName={r.name}
                  logo={r.logo}
                  size={22}
                />
                <small>{r.name}</small>
              </span>
            ))}
            {summary?.resources.tools.length > 3 && (
              <small>+{summary.resources.tools.length - 3} outils</small>
            )}
          </div>
          {!summary?.complete && (
            <small className="subprocess-warning">
              Analyse incomplète · voir le détail
            </small>
          )}
          {["in", "out"].flatMap((side) =>
            (side === "in" ? data.inputs : data.outputs).map((edge) => (
              <Handle
                key={`${side}:${edge.id}`}
                id={`${side}:${edge.id}`}
                type={side === "in" ? "target" : "source"}
                position={side === "in" ? Position.Left : Position.Right}
                title={`${side === "in" ? "Entrée" : "Sortie"} · ${edge.id}`}
                style={{ top: data.portOffsets[`${side}:${edge.id}`] }}
              />
            )),
          )}
          <Handle
            id="new-in"
            type="target"
            position={Position.Left}
            style={{ top: "auto", bottom: 15 }}
            title="Nouvelle entrée : choisir une sous-étape"
          />
          <Handle
            id="new-out"
            type="source"
            position={Position.Right}
            style={{ top: "auto", bottom: 15 }}
            title="Nouvelle sortie : choisir une sous-étape"
          />
        </div>
      )}
    </div>
  );
}
