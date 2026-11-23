// Opens an attached document (data URL) in a new tab, or downloads it when pop-ups are blocked.
export function openDocument(doc) {
  if (!doc?.data_url) return false;
  try {
    const [meta, b64] = doc.data_url.split(",");
    const mime = meta.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
    const bytes = meta.includes("base64") ? Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(b64));
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const w = window.open(url, "_blank", "noopener");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch {
    return false;
  }
}
