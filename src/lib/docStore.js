// Documents drive — folders + files stored in the browser's IndexedDB (far larger than localStorage,
// and keeps real Blobs instead of base64). Each record lives in a "space":
//   "me:<userCode>"  → the user's private files
//   "shared"         → company shared drive (HR / admins write, everyone reads)
// Record: { id, space, parentId (null = root), kind: "folder" | "file", name, size, type, blob, createdAt, updatedAt, by }

const DB_NAME = "peoplehub-docs";
const STORE = "items";
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("This browser does not support file storage (IndexedDB)."));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("space", "space", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const os = t.objectStore(STORE);
        let result;
        Promise.resolve(fn(os, (r) => (result = r))).catch(reject);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("Storage transaction aborted (storage may be full)."));
      })
  );
}

const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function listSpace(space) {
  return tx("readonly", (os, done) => {
    const req = os.index("space").getAll(space);
    req.onsuccess = () => done(req.result || []);
  });
}

function putAll(records) {
  return tx("readwrite", (os) => records.forEach((r) => os.put(r)));
}

export function deleteIds(ids) {
  return tx("readwrite", (os) => ids.forEach((id) => os.delete(id)));
}

/** All ids in the subtree of `id` (inclusive), given the space's items. */
export function subtreeIds(items, id) {
  const out = [id];
  for (let i = 0; i < out.length; i++) items.filter((x) => x.parentId === out[i]).forEach((x) => out.push(x.id));
  return out;
}

/** Make a name unique among siblings: "Report.pdf" → "Report (2).pdf". */
export function uniqueName(items, parentId, name, kind, ignoreId) {
  const taken = new Set(items.filter((x) => x.parentId === parentId && x.kind === kind && x.id !== ignoreId).map((x) => x.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const dot = kind === "file" ? name.lastIndexOf(".") : -1;
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export async function createFolder(space, parentId, name, by) {
  const items = await listSpace(space);
  const now = new Date().toISOString();
  const rec = { id: uid("FLD"), space, parentId, kind: "folder", name: uniqueName(items, parentId, name.trim(), "folder"), createdAt: now, updatedAt: now, by };
  await putAll([rec]);
  return rec;
}

export async function renameItem(space, id, name) {
  const items = await listSpace(space);
  const item = items.find((x) => x.id === id);
  if (!item) return;
  await putAll([{ ...item, name: uniqueName(items, item.parentId, name.trim(), item.kind, id), updatedAt: new Date().toISOString() }]);
}

export async function moveItem(space, id, newParentId) {
  const items = await listSpace(space);
  const item = items.find((x) => x.id === id);
  if (!item) return;
  if (item.kind === "folder" && newParentId && subtreeIds(items, id).includes(newParentId)) throw new Error("A folder can't be moved inside itself.");
  await putAll([{ ...item, parentId: newParentId, name: uniqueName(items, newParentId, item.name, item.kind, id), updatedAt: new Date().toISOString() }]);
}

export async function removeItem(space, id) {
  const items = await listSpace(space);
  await deleteIds(subtreeIds(items, id));
}

/**
 * Upload a batch of entries into `parentId`.
 * entries: [{ file: File, path: "Folder/Sub/name.ext" | "name.ext" }]
 * Intermediate folders are created (or reused when a folder of that name already exists).
 */
export async function uploadEntries(space, parentId, entries, by, extraFolders = []) {
  const items = await listSpace(space);
  const now = new Date().toISOString();
  const created = [];
  const folderCache = new Map(); // "parentId/name" → id

  const ensureFolder = (pid, name) => {
    const key = `${pid}/${name.toLowerCase()}`;
    if (folderCache.has(key)) return folderCache.get(key);
    const existing = [...items, ...created].find((x) => x.kind === "folder" && x.parentId === pid && x.name.toLowerCase() === name.toLowerCase());
    const id = existing ? existing.id : uid("FLD");
    if (!existing) created.push({ id, space, parentId: pid, kind: "folder", name, createdAt: now, updatedAt: now, by });
    folderCache.set(key, id);
    return id;
  };

  const ensurePath = (parts) => parts.reduce((pid, part) => ensureFolder(pid, part), parentId);

  // Empty folders dropped via drag & drop
  extraFolders.forEach((p) => ensurePath(p.split("/").filter(Boolean)));

  for (const { file, path } of entries) {
    const parts = (path || file.name).split("/").filter(Boolean);
    const fileName = parts.pop() || file.name;
    const pid = ensurePath(parts);
    created.push({
      id: uid("DOC"),
      space,
      parentId: pid,
      kind: "file",
      name: uniqueName([...items, ...created], pid, fileName, "file"),
      size: file.size,
      type: file.type || "application/octet-stream",
      blob: file,
      createdAt: now,
      updatedAt: now,
      by,
    });
  }
  await putAll(created);
  return { files: created.filter((x) => x.kind === "file").length, folders: created.filter((x) => x.kind === "folder").length };
}

/** Recursively read a drag & drop DataTransfer, keeping folder structure. */
export async function readDataTransfer(dataTransfer) {
  const entries = [];
  const emptyFolders = [];
  const roots = [...(dataTransfer.items || [])].map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));
  if (!roots.some(Boolean)) {
    return { entries: [...(dataTransfer.files || [])].map((file) => ({ file, path: file.name })), emptyFolders };
  }
  const readAllDir = (reader) =>
    new Promise((resolve, reject) => {
      const all = [];
      const next = () => reader.readEntries((batch) => (batch.length ? (all.push(...batch), next()) : resolve(all)), reject);
      next();
    });
  const walk = async (entry, prefix) => {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      entries.push({ file, path: `${prefix}${file.name}` });
    } else if (entry.isDirectory) {
      const children = await readAllDir(entry.createReader());
      if (!children.length) emptyFolders.push(`${prefix}${entry.name}`);
      for (const child of children) await walk(child, `${prefix}${entry.name}/`);
    }
  };
  for (const root of roots) await walk(root, "");
  return { entries, emptyFolders };
}

/** One-time import of the old localStorage uploads (base64 data URLs) into the user's drive root. */
export async function importLegacy(space, legacyDocs, by) {
  if (!legacyDocs?.length) return 0;
  const now = new Date().toISOString();
  const items = await listSpace(space);
  const recs = [];
  for (const d of legacyDocs) {
    try {
      const blob = await (await fetch(d.data)).blob();
      recs.push({ id: uid("DOC"), space, parentId: null, kind: "file", name: uniqueName([...items, ...recs], null, d.name, "file"), size: d.size || blob.size, type: d.type || blob.type, blob, createdAt: now, updatedAt: now, by });
    } catch {
      /* skip unreadable legacy entry */
    }
  }
  await putAll(recs);
  return recs.length;
}

export function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Store one file (e.g. a learning video) and return its id. */
export async function putFile(space, file, by) {
  const now = new Date().toISOString();
  const rec = { id: uid("FIL"), space, parentId: null, kind: "file", name: file.name, size: file.size, type: file.type || "application/octet-stream", blob: file, createdAt: now, updatedAt: now, by };
  await putAll([rec]);
  return rec.id;
}
export function getItem(id) {
  return tx("readonly", (os, done) => {
    const req = os.get(id);
    req.onsuccess = () => done(req.result || null);
  });
}
