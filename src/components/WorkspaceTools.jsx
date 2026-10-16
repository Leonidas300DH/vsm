import { useState } from "react";
import { Undo2, Redo2, SlidersHorizontal, LockKeyhole, UnlockKeyhole } from "lucide-react";
import Header from "./Header";
import useModalKeyboard from "./useModalKeyboard.js";
import useStore from "../store/useStore";
import {migrateProject} from "../services/project.js";
import { makePortable, downloadJSON, importEmbedded } from "../services/portable.js";
import { useReactFlow } from "reactflow";
import AnalysisPanel from "./AnalysisPanel";

const labels = {
  loading: "Récupération…",
  pending: "Modifications à enregistrer",
  saving: "Sauvegarde en cours…",
  saved: "Enregistré",
  error: "Erreur de sauvegarde",
  conflict: "Conflit entre onglets",
};
export default function WorkspaceTools({ onInspect, onArrange, onExample, children }) {
  const { fitView } = useReactFlow();
  const [presentation, setPresentation] = useState(null);
  const [layoutWarning,setLayoutWarning]=useState(false);
  const changeDetail=mode=>{
    useStore.getState().setDetailMode(mode);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const boxes=[...document.querySelectorAll('.react-flow__node,.react-flow__edgelabel-renderer>.nodrag')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
      setLayoutWarning(boxes.some((a,i)=>boxes.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)));
    }));
  };
  const present = (items, index) => {
    const id = items[index]?.nodeId;
    if (!id) return;
    setPresentation({ items, index });
    fitView({ nodes: [{ id }], padding: 0.5, maxZoom: 1, duration: 200 });
  };
  const s = useStore();
  const [atelier, setAtelier] = useState(false);
  const [portable,setPortable]=useState("");
  const [open, setOpen] = useState(false),
    [versions, setVersions] = useState([]),
    [projects, setProjects] = useState([]),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  useModalKeyboard(open,()=>setOpen(false));
  const run = async (fn) => {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };
  const refresh = async () => {
    setVersions(await s.listVersions());
    setProjects(await s.listProjects());
  };
  return (
    <>
      <Header onExample={onExample} onHistory={() => run(async () => { await refresh(); setOpen(true); })}>
        <span role="status" className={`save-state ${s.saveStatus}`}><span className="save-dot" />{labels[s.saveStatus]}</span>
        <button className="atelier-trigger" onClick={() => setAtelier(true)}><SlidersHorizontal size={15} />Atelier</button>
      </Header>
      <div className="workspace-tools" role="group" aria-label="Commandes de la carte">
        <div className="history-actions">
          <button className="icon-command" aria-label="Annuler" title="Annuler" onClick={() => s.undoBusiness()} disabled={!s.canUndo}><Undo2 size={16} /></button>
          <button className="icon-command" aria-label="Rétablir" title="Rétablir" onClick={() => s.redoBusiness()} disabled={!s.canRedo}><Redo2 size={16} /></button>
        </div>
        <span className="toolbar-divider" />
        {presentation && (
          <>
            <button
              disabled={!presentation.index}
              onClick={() =>
                present(presentation.items, presentation.index - 1)
              }
            >
              Précédent
            </button>
            <span>
              {presentation.index + 1}/{presentation.items.length}
            </span>
            <button
              disabled={presentation.index === presentation.items.length - 1}
              onClick={() =>
                present(presentation.items, presentation.index + 1)
              }
            >
              Suivant
            </button>
            <button onClick={() => setPresentation(null)}>
              Quitter la présentation
            </button>
          </>
        )}
        <select
          aria-label="Niveau de détail"
          value={s.detailMode}
          onChange={(e) => changeDetail(e.target.value)}
        >
          <option value="overview">Vue d’ensemble</option>
          <option value="operations">Opérations</option>
          <option value="detailed">Données détaillées</option>
        </select>
        {children}
        {layoutWarning && <button onClick={()=>{setLayoutWarning(false);onArrange();}}>Chevauchement détecté · Réagencer</button>}
        {s.comparisonIds.length>0 && <button onClick={()=>useStore.setState({comparisonIds:[]})}>Quitter la comparaison</button>}
        {s.selectedNodeId && s.nodes.some((n) => n.id === s.selectedNodeId) && (
          <button className="icon-command" aria-label={s.nodes.find(n=>n.id===s.selectedNodeId).data.positionLocked ? "Déverrouiller la position" : "Verrouiller la position"} title="Verrouiller ou déverrouiller la position"
            onClick={() =>
              s.updateNodeData(s.selectedNodeId, {
                positionLocked: !s.nodes.find((n) => n.id === s.selectedNodeId)
                  .data.positionLocked,
              })
            }
          >
            {s.nodes.find((n) => n.id === s.selectedNodeId).data.positionLocked
              ? <UnlockKeyhole size={16} />
              : <LockKeyhole size={16} />}
          </button>
        )}
        {s.saveError && <span role="alert">{s.saveError}</span>}
        {s.saveStatus === "conflict" ? (
          <button onClick={() => run(s.recoverCopy)}>
            Créer une copie de récupération
          </button>
        ) : (
          s.saveStatus === "error" && (
            <button onClick={() => run(s.flushWorkspace)}>Réessayer</button>
          )
        )}
      </div>
      {atelier && (
        <AnalysisPanel
          onPresent={(items) => {
            setAtelier(false);
            present(items, 0);
          }}
          onClose={() => setAtelier(false)}
          onInspect={(id, diagnostic) => {
            onInspect(id, diagnostic);
            setAtelier(false);
          }}
        />
      )}
      {open && (
        <div className="studio-backdrop">
          <section
            className="studio-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Projets et historique"
          >
            <header>
              <h2>Projets et historique</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer l’historique"
              >
                ×
              </button>
            </header>
            <p>
              Projets complets enregistrés sur cet appareil. Les 50 dernières
              versions automatiques et toutes les versions nommées sont
              conservées.
            </p>
            <div className="studio-row">
              <input
                aria-label="Nom de version"
                placeholder="Nommer cette version"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                disabled={!name.trim()}
                onClick={() =>
                  run(async () => {
                    await s.flushWorkspace(name.trim());
                    setName("");
                    await refresh();
                  })
                }
              >
                Créer une version
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            <button
              onClick={() =>
                run(async () => {
                  const exported = await makePortable(
                    s.getWorkspaceProject(),
                    versions,
                  );
                  if (
                    exported.missingFiles.length &&
                    !window.confirm(
                      "Pièces manquantes : " +
                        exported.missingFiles
                          .map((f) => f.name || f.id)
                          .join(", ") +
                        ". Exporter avec les références ?",
                    )
                  )
                    return;
                  setPortable(JSON.stringify(exported,null,2));
                  downloadJSON(exported, s.projectTitle + "-avec-versions.vsm");
                })
              }
            >
              Exporter avec les versions nommées
            </button>
            {portable&&<details open><summary>Contenu du fichier portable</summary><p>Si le navigateur ne télécharge pas le fichier, copier ce JSON dans un fichier .vsm.</p><textarea aria-label="Contenu VSM exporté" readOnly value={portable}/><button onClick={()=>run(()=>navigator.clipboard.writeText(portable))}>Copier le JSON</button></details>}
            <label>Importer un projet VSM<input type="file" aria-label="Importer un projet VSM" accept=".vsm,.json" onChange={e=>{const file=e.target.files[0];if(file)run(async()=>{const raw=migrateProject(JSON.parse(await file.text()));await importEmbedded(raw);await s.replaceWorkspace(raw);await refresh();});e.target.value='';}}/></label>
            <h3>Projets locaux</h3>
            {projects.map((p) => (
              <div className="studio-row" key={p.id}>
                <span>{p.project.title}</span>
                <small>{new Date(p.updatedAt).toLocaleString()}</small>
                <button
                  onClick={() =>
                    run(async () => {
                      await s.openSavedProject(p.id);
                      await refresh();
                    })
                  }
                >
                  Ouvrir
                </button>
              </div>
            ))}
            <h3>Historique du projet</h3>
            {versions.map((v) => (
              <div className="studio-row" key={v.id}>
                <span>{v.name || "Sauvegarde automatique"}</span>
                <small>
                  {new Date(v.updatedAt).toLocaleString()} · r{v.revision}
                </small>
                <button
                  onClick={() =>
                    run(async () => {
                      await s.restoreVersion(v);
                      await refresh();
                    })
                  }
                >
                  Restaurer
                </button>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
