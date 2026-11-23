// v10.8 · Runtime SEO: title, description, robots, canonical and social tags per screen.
// Public pages (welcome / pricing / contact / sign-in) are indexable; every signed-in screen is noindex.
function tag(attr, key, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
function link(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { el?.remove(); return; }
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}
// The public site root: <meta name="ezy:site"> written by the pre-renderer/server, else this page's origin.
export function siteUrl() {
  const m = typeof document !== "undefined" && document.head.querySelector('meta[name="ezy:site"]')?.getAttribute("content");
  return (m && !m.includes("__SITE_URL__") ? m : typeof location !== "undefined" ? location.origin : "").replace(/\/+$/, "");
}
export function applySeo({ title, description, index = false, path = null, image = "/brand/logo-640.png" }) {
  if (typeof document === "undefined") return;
  if (title) document.title = title;
  if (description) { tag("name", "description", description); tag("property", "og:description", description); tag("name", "twitter:description", description); }
  if (title) { tag("property", "og:title", title); tag("name", "twitter:title", title); }
  tag("name", "robots", index ? "index, follow, max-image-preview:large" : "noindex, nofollow");
  const site = siteUrl();
  link("canonical", index && path ? `${site}${path}` : null);
  if (index && path) tag("property", "og:url", `${site}${path}`);
  tag("property", "og:image", `${site}${image}`);
}
