const DB_NAME = "vsm-files",
  STORE_NAME = "files";
export const initDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
async function transaction(mode, action) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    let result;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Transaction de pièce jointe interrompue"));
    };
    try {
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => {
        result = request.result;
      };
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
// WebKit may abort IndexedDB writes of Blob values in ephemeral/private stores.
// Store bytes instead; keep the public file API and legacy Blob records compatible.
export const saveFile = async (file) => {
  const content =
    file.content instanceof Blob
      ? {
          encoding: "vsm-array-buffer",
          mimeType: file.content.type,
          bytes: await file.content.arrayBuffer(),
        }
      : file.content;
  return transaction("readwrite", (store) => store.put({ ...file, content }));
};
export const getFile = async (id) => {
  const file = await transaction("readonly", (store) => store.get(id));
  if (file?.content?.encoding === "vsm-array-buffer")
    file.content = new Blob([file.content.bytes], {
      type: file.content.mimeType,
    });
  return file;
};
export const deleteFile = (id) =>
  transaction("readwrite", (store) => store.delete(id));
