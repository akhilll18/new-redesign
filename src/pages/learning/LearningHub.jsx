// Learning: (1) My learning – employees add their own learning videos, documents or links and send them to colleagues
// for review; (2) Shared with me – review what colleagues sent you; (3) Training library – the company library.
import React, { useEffect, useMemo, useRef, useState } from "react";
import ListSelect from "../../components/kit/ListSelect.jsx";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, MenuItem, Rating, Select, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import { AddRounded, CloudUploadRounded, LinkRounded, MovieRounded, DescriptionRounded, SendRounded, ContentCopyRounded, DeleteOutlineRounded, OpenInNewRounded, RateReviewRounded, CloseRounded, DownloadRounded } from "@mui/icons-material";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../store/AppStore.jsx";
import { PageHeader, SectionCard, EmptyState, Tag } from "../../components/kit/UI.jsx";
import PeoplePicker from "../../components/kit/PeoplePicker.jsx";
import { directory } from "../../lib/collab.js";
import { putFile, getItem, deleteIds, formatSize } from "../../lib/docStore.js";
import { timeAgo } from "../../lib/utils.js";
import LearningPage from "../LearningPage.jsx";

const SPACE = "learning";
const MAX = 200 * 1024 * 1024;
const CATS = ["Skill", "Product knowledge", "Tools & systems", "Process / SOP", "Compliance", "Soft skills", "Certification prep"];

const itemLink = (id) => `${window.location.origin}${window.location.pathname}#/learning?item=${id}`;
const isVideo = (it) => it.kind === "file" ? (it.type || "").startsWith("video/") : /youtu\.?be|vimeo|loom|\.mp4/i.test(it.url || "");
const avg = (it) => (it.reviews?.length ? (it.reviews.reduce((t, r) => t + r.rating, 0) / it.reviews.length).toFixed(1) : null);

function embedUrl(url) {
  const y = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (y) return `https://www.youtube.com/embed/${y[1]}`;
  const v = url.match(/vimeo\.com\/(\d+)/);
  if (v) return `https://player.vimeo.com/video/${v[1]}`;
  const l = url.match(/loom\.com\/share\/(\w+)/);
  if (l) return `https://www.loom.com/embed/${l[1]}`;
  return null;
}

function AddDialog({ open, onClose }) {
  const { user, addLearningItem, notifyToast } = useStore();
  const [f, setF] = useState({ kind: "file", title: "", description: "", category: CATS[0], url: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  useEffect(() => { if (open) { setF({ kind: "file", title: "", description: "", category: CATS[0], url: "" }); setFile(null); setError(""); } }, [open]);
  const save = async () => {
    setError("");
    if (f.kind === "file" && !file) return setError("Choose a video or document to upload.");
    if (file && file.size > MAX) return setError(`Files are limited to ${formatSize(MAX)}.`);
    setBusy(true);
    try {
      let meta = {};
      if (f.kind === "file") meta = { file_id: await putFile(SPACE, file, user.code), file_name: file.name, size: file.size, type: file.type };
      const r = addLearningItem({ ...f, ...meta });
      if (!r.ok) { if (meta.file_id) await deleteIds([meta.file_id]); setBusy(false); return setError(r.error); }
      notifyToast("Added to My learning. Share it with colleagues for review.");
      onClose(r.id);
    } catch (e) {
      setError(e?.name === "QuotaExceededError" ? "Browser storage is full." : e.message || "Upload failed.");
    }
    setBusy(false);
  };
  return (
    <Dialog open={open} onClose={() => onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add learning</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <ToggleButtonGroup size="small" exclusive value={f.kind} onChange={(_, v) => v && setF({ ...f, kind: v })}>
            <ToggleButton value="file" sx={{ fontSize: "0.62rem" }}><CloudUploadRounded sx={{ fontSize: 16, mr: 0.6 }} />Upload video / document</ToggleButton>
            <ToggleButton value="link" sx={{ fontSize: "0.62rem" }}><LinkRounded sx={{ fontSize: 16, mr: 0.6 }} />Web link (YouTube, course…)</ToggleButton>
          </ToggleButtonGroup>
          {f.kind === "file" ? (
            <Box onClick={() => input.current?.click()} sx={{ p: 2, border: "2px dashed #cfdbd0", borderRadius: 1.5, textAlign: "center", cursor: "pointer", "&:hover": { background: "#f6faf7" } }}>
              <input ref={input} type="file" hidden accept="video/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md" onChange={(e) => { const x = e.target.files?.[0]; if (x) { setFile(x); if (!f.title) setF((cur) => ({ ...cur, title: x.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") })); } e.target.value = ""; }} />
              {file ? <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }}>{file.name} · {formatSize(file.size)}</Typography> : <><CloudUploadRounded sx={{ color: "#7fa58a" }} /><Typography sx={{ fontSize: "0.66rem", color: "#5c675f" }}>Choose a video, PDF, Word, PowerPoint or Excel file (up to {formatSize(MAX)})</Typography></>}
            </Box>
          ) : (
            <TextField size="small" label="Link *" placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          )}
          <TextField size="small" label="Title *" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <ListSelect listKey="learning_category" size="small" blank={false} label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} />
          <TextField size="small" label="What should reviewers look at?" multiline minRows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={save}>{busy ? "Uploading…" : "Add"}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ShareDialog({ item, onClose }) {
  const { data, user, shareLearningItem, notifyToast } = useStore();
  const [to, setTo] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setTo([]); setMsg(""); setError(""); }, [item?.id]);
  if (!item) return null;
  const people = directory(data).filter((p) => p.code !== user.code && p.kind === "emp" && !item.shares.some((s) => s.to === p.code));
  const copy = async () => { try { await navigator.clipboard.writeText(itemLink(item.id)); notifyToast("Link copied."); } catch { notifyToast("Couldn't copy the link.", "error"); } };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Send “{item.title}” for review</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <PeoplePicker people={people} value={to} onChange={setTo} label="Reviewers" placeholder="Type a colleague's name…" autoFocus />
          <TextField size="small" label="Message (optional)" multiline minRows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Could you check the demo flow in the first 5 minutes?" />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1, borderRadius: 1, background: "#f4f7f4" }}>
            <LinkRounded sx={{ fontSize: 16, color: "#5c675f" }} />
            <Typography sx={{ fontSize: "0.6rem", flex: 1, overflowWrap: "anywhere" }}>{itemLink(item.id)}</Typography>
            <Button size="small" startIcon={<ContentCopyRounded />} onClick={copy}>Copy link</Button>
          </Stack>
          {item.shares.length > 0 && <Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>Already sent to {item.shares.length} colleague{item.shares.length === 1 ? "" : "s"}.</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<SendRounded />} onClick={() => { const r = shareLearningItem(item.id, to, msg); if (!r.ok) return setError(r.error); notifyToast(`Sent to ${r.count} colleague${r.count === 1 ? "" : "s"}; they've been notified with the link.`); onClose(); }}>Send</Button>
      </DialogActions>
    </Dialog>
  );
}

function Viewer({ item, onClose }) {
  const { user, nameOf, reviewLearningItem, notifyToast } = useStore();
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [missing, setMissing] = useState(false);
  const [rv, setRv] = useState({ rating: 0, comment: "" });
  const [error, setError] = useState("");
  const mine = item?.reviews?.find((r) => r.by === user.code);
  const canReview = item && item.owner !== user.code && item.shares.some((s) => s.to === user.code);
  useEffect(() => {
    let u = null;
    setUrl(null); setBlob(null); setMissing(false); setError("");
    setRv({ rating: mine?.rating || 0, comment: mine?.comment || "" });
    if (item?.kind === "file") getItem(item.file_id).then((rec) => { if (!rec) return setMissing(true); u = URL.createObjectURL(rec.blob); setBlob(rec.blob); setUrl(u); }).catch(() => setMissing(true));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item) return null;
  const t = item.type || "";
  const emb = item.kind === "link" ? embedUrl(item.url) : null;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{item.title}<Typography sx={{ fontSize: "0.6rem", color: "#78827b" }}>{item.category} · by {nameOf(item.owner)} · {timeAgo(item.created_at)}</Typography></Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {item.description && <Typography sx={{ fontSize: "0.68rem" }}>{item.description}</Typography>}
          <Box sx={{ borderRadius: 1.5, overflow: "hidden", background: "#f4f7f4", minHeight: 120, display: "grid", placeItems: "center" }}>
            {item.kind === "link" ? (
              emb ? <Box component="iframe" src={emb} title={item.title} allow="autoplay; fullscreen" sx={{ width: "100%", aspectRatio: "16/9", border: 0 }} /> : <Button endIcon={<OpenInNewRounded />} href={item.url} target="_blank" rel="noreferrer">Open {item.url.replace(/^https?:\/\//, "").slice(0, 40)}</Button>
            ) : missing ? (
              <Typography sx={{ p: 2, fontSize: "0.64rem", color: "#78827b", textAlign: "center" }}>The file is stored in the browser it was uploaded from. Ask {nameOf(item.owner).split(" ")[0]} to share it through Documents or a link.</Typography>
            ) : !url ? <Typography sx={{ fontSize: "0.64rem", color: "#78827b" }}>Loading…</Typography>
              : t.startsWith("video/") ? <Box component="video" src={url} controls sx={{ width: "100%", maxHeight: "60vh", background: "#000" }} />
              : t.startsWith("image/") ? <Box component="img" src={url} alt={item.title} sx={{ maxWidth: "100%", maxHeight: "60vh" }} />
              : t === "application/pdf" ? <Box component="iframe" src={url} title={item.title} sx={{ width: "100%", height: "60vh", border: 0 }} />
              : <Stack spacing={1} sx={{ p: 2, alignItems: "center" }}><DescriptionRounded sx={{ color: "#66806a" }} /><Typography sx={{ fontSize: "0.64rem" }}>{item.file_name} · {formatSize(item.size)}</Typography></Stack>}
          </Box>
          {blob && <Button size="small" startIcon={<DownloadRounded />} sx={{ alignSelf: "flex-start" }} onClick={() => { const a = document.createElement("a"); a.href = url; a.download = item.file_name; a.click(); }}>Download</Button>}
          {canReview && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid #e5eae5" }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.7rem", mb: 1 }}>{mine ? "Your review (you can update it)" : "Your review"}</Typography>
              {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
              <Stack spacing={1.2}>
                <Rating value={rv.rating} onChange={(_, v) => setRv({ ...rv, rating: v || 0 })} />
                <TextField size="small" multiline minRows={2} label="Comments for the owner" value={rv.comment} onChange={(e) => setRv({ ...rv, comment: e.target.value })} />
                <Button variant="contained" startIcon={<RateReviewRounded />} sx={{ alignSelf: "flex-start" }} onClick={() => { const r = reviewLearningItem(item.id, rv); if (!r.ok) return setError(r.error); notifyToast("Review sent to the owner."); onClose(); }}>Send review</Button>
              </Stack>
            </Box>
          )}
          {item.owner === user.code && (
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "0.7rem", mb: 0.6 }}>Reviews {avg(item) ? `· ${avg(item)}/5` : ""}</Typography>
              {item.reviews?.length ? item.reviews.map((r) => (
                <Box key={r.by} sx={{ py: 0.8, borderBottom: "1px solid #f0f2ef" }}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}><Typography sx={{ fontSize: "0.64rem", fontWeight: 700 }}>{nameOf(r.by)}</Typography><Rating size="small" readOnly value={r.rating} /><Typography sx={{ fontSize: "0.56rem", color: "#78827b" }}>{timeAgo(r.at)}</Typography></Stack>
                  <Typography sx={{ fontSize: "0.64rem" }}>{r.comment}</Typography>
                </Box>
              )) : <Typography sx={{ fontSize: "0.62rem", color: "#78827b" }}>{item.shares.length ? `Waiting for ${item.shares.length} reviewer${item.shares.length === 1 ? "" : "s"}.` : "Not sent for review yet."}</Typography>}
              {item.shares.length > 0 && <Stack direction="row" sx={{ gap: 0.5, flexWrap: "wrap", mt: 1 }}>{item.shares.map((s) => <Chip key={s.to} size="small" label={`${nameOf(s.to).split(" ")[0]} · ${item.reviews?.some((r) => r.by === s.to) ? "reviewed" : "pending"}`} color={item.reviews?.some((r) => r.by === s.to) ? "success" : "default"} variant="outlined" />)}</Stack>}
            </Box>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function ItemCard({ it, onOpen, actions, sub, badge }) {
  return (
    <Box onClick={() => onOpen(it)} sx={{ cursor: "pointer", p: 1.6, border: "1px solid #e6ebe5", borderRadius: 1.5, background: "#fff", display: "flex", flexDirection: "column", gap: 0.8, "&:hover": { borderColor: "#b9cdbd" } }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 1, display: "grid", placeItems: "center", background: isVideo(it) ? "#eaf1f7" : "#ebf3ec", color: isVideo(it) ? "#5b829f" : "#517c5d" }}>{isVideo(it) ? <MovieRounded /> : it.kind === "link" ? <LinkRounded /> : <DescriptionRounded />}</Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: "0.72rem", fontWeight: 700 }}>{it.title}</Typography>
          <Typography noWrap sx={{ fontSize: "0.56rem", color: "#78827b" }}>{sub}</Typography>
        </Box>
      </Stack>
      {badge && <Box>{badge}</Box>}
      {it.description && <Typography sx={{ fontSize: "0.6rem", color: "#5c675f", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.description}</Typography>}
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "flex-end", gap: 0.4, flexWrap: "wrap", borderTop: "1px solid #f0f2ef", pt: 0.8 }} onClick={(e) => e.stopPropagation()}>{actions}</Stack>
    </Box>
  );
}

import { LearningRequest } from "../v106/SelfService.jsx";

export default function LearningHub({ libraryProps }) {
  const { data, user, nameOf, deleteLearningItem, notifyToast } = useStore();
  const [params, setParams] = useSearchParams();
  const items = data.learningItems || [];
  const mine = items.filter((i) => i.owner === user.code);
  const shared = items.filter((i) => i.shares?.some((s) => s.to === user.code));
  const toReview = shared.filter((i) => !i.reviews?.some((r) => r.by === user.code));
  const [tab, setTab] = useState(() => (params.get("item") && shared.some((i) => i.id === params.get("item")) ? "shared" : "mine"));
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const id = params.get("item");
    if (!id) return;
    const it = items.find((i) => i.id === id && (i.owner === user.code || i.shares?.some((s) => s.to === user.code)));
    if (it) { setOpen(it); setTab(it.owner === user.code ? "mine" : "shared"); }
    else notifyToast("That learning item isn't shared with you.", "info");
  }, [params.get("item")]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { setOpen(null); if (params.get("item")) setParams({}); };
  const live = (it) => it && items.find((i) => i.id === it.id);
  const grid = { display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))", lg: "repeat(3, minmax(0,1fr))" }, gap: 1.5 };
  return (
    <>
      <PageHeader eyebrow="TALENT · LEARNING" title="Learning" subtitle="Add your own learning videos and documents, send them to colleagues for review, and browse the company training library." actions={<Button variant="contained" startIcon={<AddRounded />} onClick={() => { setTab("mine"); setAdding(true); }}>Add learning</Button>} />
      <Box sx={{ borderBottom: "1px solid #e5eae4", mb: 2.5 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab value="mine" label={`My learning (${mine.length})`} sx={{ fontSize: "0.7rem" }} />
          <Tab value="shared" label={`Shared with me${toReview.length ? ` · ${toReview.length} to review` : ""}`} sx={{ fontSize: "0.7rem" }} />
          <Tab value="library" label="Training library" sx={{ fontSize: "0.7rem" }} />
        </Tabs>
      </Box>
      {tab === "mine" && user.role === "emp" && <Box sx={{ mb: 2 }}><LearningRequest /></Box>}
      {tab === "mine" && (
        mine.length ? (
          <Box sx={grid}>
            {mine.map((it) => (
              <ItemCard key={it.id} it={it} onOpen={setOpen} sub={`${it.category} · ${it.kind === "file" ? formatSize(it.size) : "link"} · ${timeAgo(it.created_at)}`} badge={it.shares.length > 0 ? <Tag tone={it.reviews?.length === it.shares.length ? "good" : "info"}>{it.reviews?.length || 0}/{it.shares.length} reviewed{avg(it) ? ` · ${avg(it)}★` : ""}</Tag> : null} actions={<>
                <Button size="small" startIcon={<SendRounded sx={{ fontSize: 14 }} />} onClick={() => setSharing(it)}>Send for review</Button>
                <Tooltip title="Copy link"><IconButton size="small" onClick={async () => { try { await navigator.clipboard.writeText(itemLink(it.id)); notifyToast("Link copied. Only colleagues you send it to can open it."); } catch { notifyToast("Couldn't copy.", "error"); } }}><ContentCopyRounded sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={async () => { const r = deleteLearningItem(it.id); if (!r.ok) return notifyToast(r.error, "error"); if (r.file_id) await deleteIds([r.file_id]).catch(() => {}); notifyToast("Deleted."); }}><DeleteOutlineRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              </>} />
            ))}
          </Box>
        ) : <SectionCard><EmptyState title="Nothing here yet" text="Add a video, document or link you've made or found useful, then send it to colleagues for their review." action={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setAdding(true)}>Add learning</Button>} /></SectionCard>
      )}
      {tab === "shared" && (
        shared.length ? (
          <Box sx={grid}>
            {shared.map((it) => {
              const done = it.reviews?.some((r) => r.by === user.code);
              const note = it.shares.find((s) => s.to === user.code);
              return <ItemCard key={it.id} it={it} onOpen={setOpen} sub={`From ${nameOf(it.owner)} · ${timeAgo(note?.at)}`} badge={<Stack spacing={0.5}><Box><Tag tone={done ? "good" : "warn"}>{done ? "Reviewed" : "Review requested"}</Tag></Box>{note?.message && <Typography sx={{ fontSize: "0.58rem", fontStyle: "italic", color: "#5c675f" }}>“{note.message}”</Typography>}</Stack>} actions={<><Button size="small" variant={done ? "text" : "contained"} startIcon={<RateReviewRounded sx={{ fontSize: 14 }} />} onClick={() => setOpen(it)}>{done ? "View" : "Review"}</Button></>} />;
            })}
          </Box>
        ) : <SectionCard><EmptyState title="Nothing shared with you" text="When a colleague sends you a learning item to review, it shows up here and in your notifications." /></SectionCard>
      )}
      {tab === "library" && <LearningPage {...libraryProps} embedded />}
      <AddDialog open={adding} onClose={(id) => { setAdding(false); if (id) setSharing({ id }); }} />
      <ShareDialog item={live(sharing)} onClose={() => setSharing(null)} />
      <Viewer item={live(open)} onClose={close} />
    </>
  );
}
