import { getFile, saveFile } from "../utils/db.js";
export function attachmentReferences(project) {
  const refs = new Map();
  for (const scenario of project.scenarios || [project])
    for (const node of scenario.nodes)
      for (const a of node.data.attachments || []) refs.set(a.id, a);
  return [...refs.values()];
}
export async function makePortable(project, versions = []) {
  const result = structuredClone(project);
  result.embeddedFiles = [];
  result.missingFiles = [];
  for (const ref of [
    ...new Map(
      [project, ...versions.filter((v) => v.name).map((v) => v.project)]
        .flatMap(attachmentReferences)
        .map((r) => [r.id, r]),
    ).values(),
  ]) {
    const file = await getFile(ref.id);
    if (!file?.content) {
      result.missingFiles.push(ref);
      continue;
    }
    const content = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file.content);
    });
    result.embeddedFiles.push({ ...file, content });
  }
  result.namedVersions = versions.filter((v) => v.name);
  return result;
}
export async function importEmbedded(project) {
  for (const file of project.embeddedFiles || []) {
    if (typeof file.content !== "string" || !file.content.startsWith("data:"))
      throw new Error("Pièce jointe embarquée invalide.");
    const response = await fetch(file.content), content=await response.blob();
    const existing=await getFile(file.id);
    if(existing?.content){
      const a=new Uint8Array(await existing.content.arrayBuffer()), b=new Uint8Array(await content.arrayBuffer());
      if(existing.content.type===content.type && a.length===b.length && a.every((byte,i)=>byte===b[i]))continue;
      const old=file.id, replacement=crypto.randomUUID();
      const remap=value=>{
        if(!value||typeof value!=="object")return;
        if(Array.isArray(value.attachments))value.attachments=value.attachments.map(ref=>ref.id===old?{...ref,id:replacement}:ref);
        for(const item of Object.values(value))if(item&&typeof item==="object")remap(item);
      };
      remap(project);file.id=replacement;
    }
    await saveFile({ ...file, content });
  }
}

export function downloadJSON(value, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
