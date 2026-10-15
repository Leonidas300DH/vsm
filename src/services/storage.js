export class ConflictError extends Error {
  constructor() {
    super(
      "Ce projet a été modifié dans un autre onglet. Enregistrez une copie de récupération.",
    );
    this.name = "ConflictError";
  }
}
export function openWorkspaceDB(factory = indexedDB) {
  return new Promise((resolve, reject) => {
    const request = factory.open("vsm-workspace", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["projects", "versions", "settings"])
        db.createObjectStore(name, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Stockage bloqué par un autre onglet."));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
export function readRecord(db, store, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const r = tx.objectStore(store).get(id);
    let value;
    r.onsuccess = () => {
      value = r.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("Lecture interrompue"));
  });
}
export function readAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store);
    const r = tx.objectStore(store).getAll();
    let value;
    r.onsuccess = () => {
      value = r.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("Lecture interrompue"));
  });
}
// Compare-and-swap, revision, version pruning and session pointer commit atomically.
export function commitProject(
  db,
  project,
  expectedRevision = 0,
  name = "",
  options = {},
) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["projects", "versions", "settings"],
      "readwrite",
    );
    let reason, revision;
    tx.oncomplete = () => resolve(revision);
    tx.onabort = tx.onerror = () =>
      reject(reason || tx.error || new Error("Transaction interrompue"));
    const projects = tx.objectStore("projects"),
      versions = tx.objectStore("versions");
    const request = projects.get(project.id);
    request.onsuccess = () => {
      try {
        if ((request.result?.revision || 0) !== expectedRevision) {
          reason = new ConflictError();
          tx.abort();
          return;
        }
        revision = expectedRevision + 1;
        const record = {
          id: project.id,
          revision,
          project: structuredClone(project),
          updatedAt: new Date().toISOString(),
        };
        projects.put(record);
        versions.put({
          ...record,
          id: crypto.randomUUID(),
          projectId: project.id,
          name,
        });
        tx.objectStore("settings").put({
          id: "lastProject",
          projectId: project.id,
        });
        const all = versions.getAll();
        all.onsuccess = () => {
          const autos = all.result
            .filter((v) => v.projectId === project.id && !v.name)
            .sort((a, b) => b.revision - a.revision);
          autos.slice(50).forEach((v) => versions.delete(v.id));
          if (options.abort) tx.abort(); // Deterministic transaction failure exercise.
        };
      } catch (error) {
        reason = error;
        tx.abort();
      }
    };
  });
}

export function importNamedVersions(db, projectId, versions) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("versions", "readwrite");
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () =>
      reject(tx.error || new Error("Import de versions interrompu"));
    const store = tx.objectStore("versions");
    for (const version of versions) {
      if (!version.name || !version.project) continue;
      const origin=version.originVersionId||version.id;
      const existing=store.get(origin);
      existing.onsuccess=()=>{
        if(existing.result?.projectId===projectId)return;
        store.put({...version,id:`${projectId}:import:${origin}`,originVersionId:origin,projectId,project:{...structuredClone(version.project),id:projectId}});
      };
    }
  });
}
