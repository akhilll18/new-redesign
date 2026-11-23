import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import {
  Download as ArrowDownToLine,
  Description as FileText,
  Search,
  UploadFile,
  DriveFolderUpload,
  CreateNewFolder,
  Folder as FolderIcon,
  FolderShared,
  Close,
  Delete,
  Edit,
  DriveFileMove,
  MoreVert,
  ChevronRight,
  Home as HomeIcon,
  Image as ImageIcon,
  PictureAsPdf,
  TableChart,
  CloudUpload,
  LibraryBooks,
  Lock,
} from "@mui/icons-material";
import { documents as seedDocuments } from "../data/peopleHubData.js";
import { Badge, Button, EmptyState, PageHeader } from "../components/PortalUI.jsx";
import {
  listSpace,
  createFolder,
  renameItem,
  moveItem,
  removeItem,
  uploadEntries,
  readDataTransfer,
  importLegacy,
  formatSize,
  subtreeIds,
} from "../lib/docStore.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
const legacyImportStarted = new Set(); // guards the one-time import against StrictMode double effects

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileIcon(item) {
  if (item.kind === "folder") return { Icon: FolderIcon, bg: "#fcf0e8", color: "#bd7952" };
  const t = item.type || "";
  const n = item.name.toLowerCase();
  if (t.startsWith("image/")) return { Icon: ImageIcon, bg: "#eaf1f7", color: "#5b829f" };
  if (t === "application/pdf" || n.endsWith(".pdf")) return { Icon: PictureAsPdf, bg: "#f5edef", color: "#a76e73" };
  if (/\.(xlsx?|csv)$/.test(n)) return { Icon: TableChart, bg: "#ebf3ec", color: "#517c5d" };
  return { Icon: FileText, bg: "#ebf3ec", color: "#517c5d" };
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "");

const tabSx = (active) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 0.6,
  flexShrink: 0,
  px: 1.2,
  py: 0.7,
  borderRadius: 0.6,
  background: active ? "#ebf3ec" : "transparent",
  color: active ? "#39644a" : "#7e8981",
  fontSize: "0.62rem",
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  "&:hover": { color: "primary.main" },
});

export default function DocumentsPage({
  user,
  canManageShared = false,
  legacyDocuments = [],
  onLegacyImported,
  notify = () => {},
  topSlot = null,
}) {
  const userCode = user?.code || "anon";
  const by = user?.full_name || user?.name || userCode;
  const [spaceKey, setSpaceKey] = useState("me"); // "me" | "shared" | "library"
  const space = spaceKey === "shared" ? "shared" : `me:${userCode}`;
  const canWrite = spaceKey === "me" || (spaceKey === "shared" && canManageShared);

  const [items, setItems] = useState([]);
  const [folderId, setFolderId] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null); // { item, url }
  const [nameDialog, setNameDialog] = useState(null); // { mode: "new" | "rename", item?, value }
  const [moveDialog, setMoveDialog] = useState(null); // { item, target }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [menu, setMenu] = useState(null); // { anchor, item }
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const dragDepth = useRef(0);

  const refresh = useCallback(async () => {
    if (spaceKey === "library") return;
    try {
      setItems(await listSpace(space));
    } catch (e) {
      notify(e.message || "Couldn't open document storage.", "error");
    }
  }, [space, spaceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFolderId(null);
    setQuery("");
    refresh();
  }, [refresh]);

  // Move old localStorage uploads into the new drive once.
  useEffect(() => {
    if (!legacyDocuments.length || legacyImportStarted.has(userCode)) return;
    legacyImportStarted.add(userCode);
    importLegacy(`me:${userCode}`, legacyDocuments, by).then((n) => {
      onLegacyImported?.();
      if (n) {
        notify(`${n} earlier upload${n === 1 ? "" : "s"} moved into My files.`, "info");
        refresh();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The folder webkitdirectory attribute isn't a React prop, so set it directly.
  useEffect(() => {
    if (folderInput.current) {
      folderInput.current.setAttribute("webkitdirectory", "");
      folderInput.current.setAttribute("directory", "");
    }
  }, [spaceKey]);

  const byId = useMemo(() => new Map(items.map((x) => [x.id, x])), [items]);
  const breadcrumbs = useMemo(() => {
    const trail = [];
    let cur = folderId ? byId.get(folderId) : null;
    while (cur) {
      trail.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return trail;
  }, [folderId, byId]);

  const pathOf = useCallback(
    (item) => {
      const parts = [];
      let cur = item.parentId ? byId.get(item.parentId) : null;
      while (cur) {
        parts.unshift(cur.name);
        cur = cur.parentId ? byId.get(cur.parentId) : null;
      }
      return parts.join(" / ");
    },
    [byId]
  );

  const folderStats = useCallback(
    (id) => {
      const ids = subtreeIds(items, id).slice(1);
      const files = ids.map((x) => byId.get(x)).filter((x) => x?.kind === "file");
      return { count: files.length, size: files.reduce((a, f) => a + (f.size || 0), 0) };
    },
    [items, byId]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((x) => x.name.toLowerCase().includes(q)) : items.filter((x) => x.parentId === folderId);
    return [...list].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.kind === "folder" ? -1 : 1));
  }, [items, folderId, query]);

  const totalSize = useMemo(() => items.reduce((a, x) => a + (x.size || 0), 0), [items]);

  async function doUpload(entries, emptyFolders = []) {
    if (!canWrite) return notify("Only HR and admins can add to the shared drive.", "info");
    const tooBig = entries.filter((e) => e.file.size > MAX_FILE_BYTES);
    const ok = entries.filter((e) => e.file.size <= MAX_FILE_BYTES);
    if (tooBig.length) notify(`${tooBig.length} file${tooBig.length === 1 ? " is" : "s are"} over ${formatSize(MAX_FILE_BYTES)} and ${tooBig.length === 1 ? "was" : "were"} skipped.`, "error");
    if (!ok.length && !emptyFolders.length) return;
    setBusy(true);
    try {
      const r = await uploadEntries(space, folderId, ok, by, emptyFolders);
      await refresh();
      const parts = [];
      if (r.files) parts.push(`${r.files} file${r.files === 1 ? "" : "s"}`);
      if (r.folders) parts.push(`${r.folders} folder${r.folders === 1 ? "" : "s"}`);
      notify(`Uploaded ${parts.join(" and ") || "nothing new"}.`);
    } catch (e) {
      notify(e?.name === "QuotaExceededError" ? "Browser storage is full. Remove some files and try again." : e?.message || "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (!canWrite) return notify("Only HR and admins can add to the shared drive.", "info");
    const { entries, emptyFolders } = await readDataTransfer(event.dataTransfer);
    doUpload(entries, emptyFolders);
  }

  async function openItem(item) {
    if (item.kind === "folder") {
      setQuery("");
      return setFolderId(item.id);
    }
    setPreview({ item, url: URL.createObjectURL(item.blob) });
  }

  function closePreview() {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function submitName() {
    const value = nameDialog.value.trim();
    if (!value) return;
    if (/[\\/]/.test(value)) return notify("Names can't contain / or \\.", "error");
    try {
      if (nameDialog.mode === "new") {
        await createFolder(space, folderId, value, by);
        notify(`Folder "${value}" created.`);
      } else {
        await renameItem(space, nameDialog.item.id, value);
        notify("Renamed.");
      }
      setNameDialog(null);
      refresh();
    } catch (e) {
      notify(e.message || "Couldn't save.", "error");
    }
  }

  async function submitMove() {
    try {
      await moveItem(space, moveDialog.item.id, moveDialog.target);
      notify(`Moved "${moveDialog.item.name}".`);
      setMoveDialog(null);
      refresh();
    } catch (e) {
      notify(e.message, "error");
    }
  }

  async function submitDelete() {
    const item = confirmDelete;
    await removeItem(space, item.id);
    if (item.kind === "folder" && (folderId === item.id || breadcrumbs.some((b) => b.id === item.id))) setFolderId(item.parentId);
    setConfirmDelete(null);
    notify(`"${item.name}" deleted.`);
    refresh();
  }

  const moveTargets = useMemo(() => {
    if (!moveDialog) return [];
    const blocked = moveDialog.item.kind === "folder" ? new Set(subtreeIds(items, moveDialog.item.id)) : new Set();
    const folders = items.filter((x) => x.kind === "folder" && !blocked.has(x.id));
    return [{ id: null, label: "Top level" }, ...folders.map((f) => ({ id: f.id, label: [pathOf(f), f.name].filter(Boolean).join(" / ") })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [moveDialog, items, pathOf]);

  // ── Company library (read-only reference docs, as before) ──
  const library = (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
      {seedDocuments.map((d) => (
        <Box key={d.name} sx={{ display: "flex", flexDirection: "column", minHeight: 170, p: 2, border: "1px solid #e6ebe5", borderRadius: 1, background: "#fff" }}>
          <Box sx={{ width: 34, height: 34, mb: 1.4, borderRadius: 1, background: "#ebf3ec", color: "#517c5d", display: "grid", placeItems: "center" }}>
            <FileText sx={{ fontSize: 19 }} />
          </Box>
          <Box><Badge>{d.category}</Badge></Box>
          <Typography sx={{ mt: 1.1, mb: 0.6,  fontWeight: 700, fontSize: "0.75rem", color: "#354139" }}>{d.name}</Typography>
          <Typography sx={{ flex: 1, color: "#818c84", fontSize: "0.6rem", lineHeight: 1.6 }}>{d.description}</Typography>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mt: 1.5, pt: 1.2, borderTop: "1px solid #eff1ee", color: "#9aa39b", fontSize: "0.55rem" }}>
            <span>{d.updated}</span>
            <Box
              component="button"
              onClick={() => downloadBlob(`${d.name.toLowerCase().replaceAll(" ", "-")}.txt`, new Blob([`${d.name}\n\n${d.description}\n\nSample PeopleHub document.`], { type: "text/plain" }))}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, p: 0, border: 0, background: "transparent", color: "#52755a", fontSize: "0.6rem", fontWeight: 600, cursor: "pointer" }}
            >
              <ArrowDownToLine sx={{ fontSize: 15 }} /> Download
            </Box>
          </Stack>
        </Box>
      ))}
    </Box>
  );

  return (
    <>
      <PageHeader
        eyebrow="CORE HR · DOCUMENTS"
        title="Documents"
        description="Create folders, upload files or whole folders, and keep everything organised."
        action={
          spaceKey !== "library" && canWrite ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (files.length) doUpload(files.map((file) => ({ file, path: file.name })));
                }}
              />
              <input
                ref={folderInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (files.length) doUpload(files.map((file) => ({ file, path: file.webkitRelativePath || file.name })));
                }}
              />
              <Button variant="secondary" icon={CreateNewFolder} onClick={() => setNameDialog({ mode: "new", value: "" })}>New folder</Button>
              <Button variant="secondary" icon={DriveFolderUpload} onClick={() => folderInput.current?.click()} disabled={busy}>Upload folder</Button>
              <Button icon={UploadFile} onClick={() => fileInput.current?.click()} disabled={busy}>Upload files</Button>
            </Stack>
          ) : null
        }
      />

      {topSlot}

      {/* Space switcher + search */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, mb: 1.4, mt: 0.7 }}>
        <Stack direction="row" spacing={0.4} sx={{ p: 0.4, border: "1px solid #e5eae5", borderRadius: 1, background: "#fff", overflowX: "auto", alignSelf: { md: "center" } }}>
          <Box onClick={() => setSpaceKey("me")} sx={tabSx(spaceKey === "me")}><FolderIcon sx={{ fontSize: 15 }} /> My files</Box>
          <Box onClick={() => setSpaceKey("shared")} sx={tabSx(spaceKey === "shared")}><FolderShared sx={{ fontSize: 15 }} /> Shared drive</Box>
          <Box onClick={() => setSpaceKey("library")} sx={tabSx(spaceKey === "library")}><LibraryBooks sx={{ fontSize: 15 }} /> Company library</Box>
        </Stack>
        {spaceKey !== "library" && (
          <TextField
            placeholder="Search all folders..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            sx={{
              width: { xs: "100%", md: 260 },
              "& .MuiOutlinedInput-root": { fontSize: "0.65rem", borderRadius: 1, background: "#fff", "& fieldset": { borderColor: "#e5eae5" } },
            }}
            slotProps={{ input: { startAdornment: (<InputAdornment position="start"><Search sx={{ fontSize: 16, color: "#8d9890" }} /></InputAdornment>) } }}
          />
        )}
      </Stack>

      {spaceKey === "library" ? (
        library
      ) : (
        <Box
          onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; if (canWrite) setDragOver(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) setDragOver(false); }}
          onDrop={onDrop}
          sx={{ position: "relative", border: "1px solid #e6ebe5", borderRadius: 1, background: "#fff", minHeight: 320, overflow: "hidden" }}
        >
          {busy && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0 }} />}

          {/* Breadcrumbs + info */}
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1.2, borderBottom: "1px solid #eff1ee", flexWrap: "wrap" }}>
            <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.2 }}>
              <Box component="button" onClick={() => { setFolderId(null); setQuery(""); }} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, border: 0, background: "transparent", cursor: "pointer", color: folderId ? "#52755a" : "#354139", fontWeight: 700, fontSize: "0.68rem", p: 0.3 }}>
                <HomeIcon sx={{ fontSize: 15 }} /> {spaceKey === "me" ? "My files" : "Shared drive"}
              </Box>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.id}>
                  <ChevronRight sx={{ fontSize: 15, color: "#b3bbb4" }} />
                  <Box component="button" onClick={() => { setFolderId(b.id); setQuery(""); }} sx={{ border: 0, background: "transparent", cursor: "pointer", color: i === breadcrumbs.length - 1 ? "#354139" : "#52755a", fontWeight: i === breadcrumbs.length - 1 ? 700 : 600, fontSize: "0.68rem", p: 0.3 }}>
                    {b.name}
                  </Box>
                </React.Fragment>
              ))}
              {query && <Typography sx={{ ml: 1, fontSize: "0.62rem", color: "#818c84" }}>· results for "{query}"</Typography>}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "#9aa39b", fontSize: "0.58rem" }}>
              {!canWrite && <Badge><Lock sx={{ fontSize: 11, mr: 0.3, verticalAlign: "-2px" }} />View only</Badge>}
              <span>{items.filter((x) => x.kind === "file").length} files · {formatSize(totalSize)}</span>
            </Stack>
          </Stack>

          {/* Column header */}
          {visible.length > 0 && (
            <Box sx={{ display: { xs: "none", md: "grid" }, gridTemplateColumns: "minmax(0,1fr) 120px 110px 140px 40px", px: 2, py: 0.8, color: "#9aa39b", fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid #f8faf7" }}>
              <span>Name</span><span>Size</span><span>Modified</span><span>Added by</span><span />
            </Box>
          )}

          {visible.map((item) => {
            const { Icon, bg, color } = fileIcon(item);
            const stats = item.kind === "folder" ? folderStats(item.id) : null;
            return (
              <Box
                key={item.id}
                onDoubleClick={() => openItem(item)}
                sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr) 40px", md: "minmax(0,1fr) 120px 110px 140px 40px" }, alignItems: "center", px: 2, py: 0.9, borderBottom: "1px solid #f8faf7", fontSize: "0.62rem", color: "#5f6b63", "&:hover": { background: "#f8faf7" } }}
              >
                <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", minWidth: 0, cursor: "pointer" }} onClick={() => openItem(item)}>
                  <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 1, background: bg, color, display: "grid", placeItems: "center" }}>
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{  fontWeight: 700, fontSize: "0.7rem", color: "#354139" }}>{item.name}</Typography>
                    {query && <Typography noWrap sx={{ fontSize: "0.55rem", color: "#9aa39b" }}>{pathOf(item) || "Top level"}</Typography>}
                    <Typography sx={{ display: { md: "none" }, fontSize: "0.55rem", color: "#9aa39b" }}>
                      {item.kind === "folder" ? `${stats.count} files` : formatSize(item.size)} · {fmtDate(item.updatedAt)}
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ display: { xs: "none", md: "block" } }}>{item.kind === "folder" ? `${stats.count} file${stats.count === 1 ? "" : "s"}` : formatSize(item.size)}</Box>
                <Box sx={{ display: { xs: "none", md: "block" } }}>{fmtDate(item.updatedAt)}</Box>
                <Box sx={{ display: { xs: "none", md: "block" }, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.by || "—"}</Box>
                <IconButton aria-label={`Actions for ${item.name}`} size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, item })} sx={{ color: "#8d9890" }}>
                  <MoreVert sx={{ fontSize: 17 }} />
                </IconButton>
              </Box>
            );
          })}

          {visible.length === 0 && (
            <Box sx={{ py: 6, px: 2, textAlign: "center" }}>
              {query ? (
                <EmptyState title="No matches" description="Nothing in this drive matches your search." />
              ) : (
                <Stack spacing={1} sx={{ alignItems: "center" }}>
                  <CloudUpload sx={{ fontSize: 40, color: "#b7c9bb" }} />
                  <Typography sx={{  fontWeight: 700, fontSize: "0.8rem", color: "#354139" }}>
                    {folderId ? "This folder is empty" : spaceKey === "me" ? "Your drive is empty" : "Nothing shared yet"}
                  </Typography>
                  <Typography sx={{ fontSize: "0.62rem", color: "#818c84", maxWidth: 380 }}>
                    {canWrite ? "Drag files or folders here, or use New folder, Upload files and Upload folder above." : "HR and admins can add files to the shared drive."}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          {dragOver && (
            <Box sx={{ position: "absolute", inset: 0, background: "rgba(234,242,236,0.92)", border: "2px dashed #7fa58a", borderRadius: 1, display: "grid", placeItems: "center", pointerEvents: "none", zIndex: 2 }}>
              <Stack spacing={1} sx={{ alignItems: "center" }}>
                <CloudUpload sx={{ fontSize: 42, color: "#517c5d" }} />
                <Typography sx={{  fontWeight: 700, fontSize: "0.8rem", color: "#39644a" }}>
                  Drop files or folders into {breadcrumbs.at(-1)?.name || (spaceKey === "me" ? "My files" : "Shared drive")}
                </Typography>
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* Row actions */}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { minWidth: 170 } } }}>
        <MenuItem dense onClick={() => { const it = menu.item; setMenu(null); openItem(it); }}>
          <ListItemIcon>{menu?.item.kind === "folder" ? <FolderIcon fontSize="small" /> : <FileText fontSize="small" />}</ListItemIcon>Open
        </MenuItem>
        {menu?.item.kind === "file" && (
          <MenuItem dense onClick={() => { downloadBlob(menu.item.name, menu.item.blob); setMenu(null); }}>
            <ListItemIcon><ArrowDownToLine fontSize="small" /></ListItemIcon>Download
          </MenuItem>
        )}
        {canWrite && [
          <MenuItem dense key="rename" onClick={() => { setNameDialog({ mode: "rename", item: menu.item, value: menu.item.name }); setMenu(null); }}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>Rename
          </MenuItem>,
          <MenuItem dense key="move" onClick={() => { setMoveDialog({ item: menu.item, target: menu.item.parentId }); setMenu(null); }}>
            <ListItemIcon><DriveFileMove fontSize="small" /></ListItemIcon>Move to…
          </MenuItem>,
          <MenuItem dense key="delete" onClick={() => { setConfirmDelete(menu.item); setMenu(null); }} sx={{ color: "#a4463f" }}>
            <ListItemIcon><Delete fontSize="small" sx={{ color: "#a4463f" }} /></ListItemIcon>Delete
          </MenuItem>,
        ]}
      </Menu>

      {/* New folder / rename */}
      <Dialog open={Boolean(nameDialog)} onClose={() => setNameDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{  fontSize: "0.9rem", fontWeight: 700 }}>
          {nameDialog?.mode === "new" ? "New folder" : `Rename ${nameDialog?.item.kind}`}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={nameDialog?.mode === "new" ? "Folder name" : "Name"}
            value={nameDialog?.value || ""}
            onChange={(e) => setNameDialog((d) => ({ ...d, value: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            sx={{ mt: 1 }}
          />
          {nameDialog?.mode === "new" && (
            <Typography sx={{ mt: 1, fontSize: "0.6rem", color: "#818c84" }}>
              Created in: {breadcrumbs.map((b) => b.name).join(" / ") || (spaceKey === "me" ? "My files" : "Shared drive")}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" onClick={() => setNameDialog(null)}>Cancel</Button>
          <Button onClick={submitName} disabled={!nameDialog?.value?.trim()}>{nameDialog?.mode === "new" ? "Create" : "Save"}</Button>
        </DialogActions>
      </Dialog>

      {/* Move */}
      <Dialog open={Boolean(moveDialog)} onClose={() => setMoveDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{  fontSize: "0.9rem", fontWeight: 700 }}>Move "{moveDialog?.item.name}"</DialogTitle>
        <DialogContent dividers sx={{ p: 0, maxHeight: 340 }}>
          {moveTargets.map((t) => (
            <Box
              key={t.id || "root"}
              onClick={() => setMoveDialog((d) => ({ ...d, target: t.id }))}
              sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.9, cursor: "pointer", fontSize: "0.66rem", background: moveDialog?.target === t.id ? "#ebf3ec" : "transparent", color: moveDialog?.target === t.id ? "#39644a" : "#5f6b63", fontWeight: moveDialog?.target === t.id ? 700 : 500, "&:hover": { background: "#f3f7f3" } }}
            >
              {t.id ? <FolderIcon sx={{ fontSize: 16, color: "#bd7952" }} /> : <HomeIcon sx={{ fontSize: 16 }} />} {t.label}
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" onClick={() => setMoveDialog(null)}>Cancel</Button>
          <Button onClick={submitMove} disabled={moveDialog?.target === moveDialog?.item.parentId}>Move here</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{  fontSize: "0.9rem", fontWeight: 700 }}>Delete "{confirmDelete?.name}"?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: "0.68rem", color: "#5f6b63" }}>
            {confirmDelete?.kind === "folder"
              ? `This folder and everything inside it (${folderStats(confirmDelete.id).count} files) will be permanently deleted.`
              : "This file will be permanently deleted."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button onClick={submitDelete} sx={{ background: "#a4463f", "&:hover": { background: "#8c3a34" } }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Preview */}
      <Dialog open={Boolean(preview)} onClose={closePreview} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1,  fontSize: "0.9rem", fontWeight: 700 }}>
          <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview?.item.name}</Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Download"><IconButton size="small" onClick={() => downloadBlob(preview.item.name, preview.item.blob)}><ArrowDownToLine fontSize="small" /></IconButton></Tooltip>
            <IconButton aria-label="Close document preview" onClick={closePreview} size="small"><Close fontSize="small" /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 240, display: "grid", placeItems: "center" }}>
          {preview?.item.type?.startsWith("image/") ? (
            <Box component="img" src={preview.url} alt={preview.item.name} sx={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain" }} />
          ) : preview?.item.type === "application/pdf" ? (
            <Box component="iframe" title={preview.item.name} src={preview.url} sx={{ width: "100%", height: "65vh", border: 0 }} />
          ) : preview?.item.type?.startsWith("text/") ? (
            <Box component="iframe" title={preview.item.name} src={preview.url} sx={{ width: "100%", height: "60vh", border: 0, background: "#fff" }} />
          ) : (
            <Stack spacing={1.2} sx={{ alignItems: "center" }}>
              <FileText sx={{ fontSize: 34, color: "#66806a" }} />
              <Typography sx={{ color: "#78837b", fontSize: "0.7rem" }}>Preview isn't available for this file type ({formatSize(preview?.item.size)}).</Typography>
              <Button icon={ArrowDownToLine} onClick={() => downloadBlob(preview.item.name, preview.item.blob)}>Download file</Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
