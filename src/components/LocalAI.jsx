import { useState, useRef, useEffect } from "react";
export default function LocalAI({ pack, onResponse }) {
  const [config, setConfig] = useState(null),
    [provider, setProvider] = useState(""),
    [model, setModel] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (!local)
    return (
      <p>
        Connecteurs facultatifs disponibles dans une installation locale. Le
        site public ne lit aucune clé personnelle. Le dossier Codex reste
        utilisable ici.
      </p>
    );
  const diagnose = async () => {
    try {
      setError("");
      const response = await fetch("/api/config");
      if (!response.ok) throw new Error();
      setConfig(await response.json());
    } catch {
      setError(
        "Serveur local absent. Lancez npm run local après compilation puis ouvrez http://127.0.0.1:8787.",
      );
    }
  };
  const send = async () => {
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vsm-request": "analysis",
        },
        body: JSON.stringify({ provider, model, package: pack }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analyse échouée");
      onResponse(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(
        e.name === "AbortError"
          ? "Annulé. Aucun nouvel appel ne sera lancé."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset>
      <legend>Connecteurs IA locaux facultatifs</legend>
      <button onClick={diagnose}>Diagnostiquer la configuration locale</button>
      {config && (
        <>
          <p>
            {config.enabled
              ? "Appels autorisés par cette installation"
              : "Appels désactivés (.env : VSM_AI_ENABLED=false)"}
          </p>
          {Object.entries(config.providers).map(([id, p]) => (
            <p key={id}>
              {id} : {p.configured ? "configuré" : "absent"}
            </p>
          ))}
          <label>
            Fournisseur
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(config.providers[e.target.value]?.model || "");
                setConfirmed(false);
              }}
            >
              <option value="">Choisir</option>
              {Object.keys(config.providers).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Modèle
            <input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            J’ai vérifié le dossier affiché et souhaite le transmettre au
            fournisseur choisi.
          </label>
          <button
            disabled={
              busy ||
              !confirmed ||
              !config.enabled ||
              !config.providers[provider]?.configured ||
              !model.trim()
            }
            onClick={send}
          >
            Lancer cette analyse
          </button>
          {busy && (
            <button onClick={() => controller.current?.abort()}>
              Annuler la requête
            </button>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
