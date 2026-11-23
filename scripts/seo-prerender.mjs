// v10.8 · SEO pre-render — runs after `vite build` (npm run build).
// Writes a real, crawlable HTML page for every public URL (/, /pricing/, /contact/, /service-desk/, /login/) with its
// own title, description, canonical URL, Open Graph / Twitter tags, JSON-LD and readable content, plus robots.txt and
// sitemap.xml. When the app starts on one of these pages it opens the matching screen.
//
// SITE_URL=https://hr.example.com npm run build   → absolute URLs baked in (static hosting)
// without SITE_URL                                 → "__SITE_URL__" placeholders; the EZY HR server fills them per request
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, FAQ, PRICING, PUBLIC_PAGES, inr, jsonLd } from "../src/seo/publicPages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const SITE = (process.env.SITE_URL || "__SITE_URL__").replace(/\/+$/, "");
const template = readFileSync(join(dist, "index.html"), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);

function content(page) {
  const rel = (href) => (page.path === "/" ? href || "./" : `../${href}`);
  const LABEL = { "/": "Home", "/pricing/": "Pricing", "/contact/": "Contact", "/service-desk/": "EZY Service Desk", "/login/": "Sign in" };
  const nav = PUBLIC_PAGES.map((p) => `<a href="${rel(p.path.slice(1))}"${p.path === page.path ? ' aria-current="page"' : ""}>${LABEL[p.path] || esc(p.h1)}</a>`);
  const plans = page.pricing ? `
    <section aria-labelledby="plans"><h2 id="plans">Plans</h2>
      ${PRICING.map((p) => `<article><h3>${esc(p.name)}</h3><p><strong>${p.per ? `${inr(p.base)} per month + ${inr(p.per)} per employee` : "₹0 — free forever"}</strong></p><p>${esc(p.blurb)}</p><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></article>`).join("")}
      <p>Annual billing: two months free.</p>
    </section>` : "";
  const faq = page.faq ? `<section aria-labelledby="faq"><h2 id="faq">Frequently asked questions</h2><dl>${FAQ.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl></section>` : "";
  const sections = (page.sections || []).map(([h, p]) => `<section><h2>${esc(h)}</h2><p>${esc(p)}</p></section>`).join("");
  return `
  <div class="seo-static" style="max-width:960px;margin:0 auto;padding:24px;font-family:Manrope,'DM Sans',system-ui,sans-serif;color:#17404D;line-height:1.55">
    <header style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <img src="${rel("brand/logo-640.png")}" alt="${esc(BRAND.name)} — ${esc(BRAND.tagline)}" width="160" height="40" style="height:40px;width:auto" />
      <nav aria-label="Main" style="display:flex;gap:14px;flex-wrap:wrap;font-size:14px">${nav.join("")}</nav>
    </header>
    <main>
      <h1 style="font-size:32px;margin:28px 0 8px">${esc(page.h1)}</h1>
      <p style="font-size:17px">${esc(page.intro)}</p>
      ${sections}${plans}${faq}
      <p><a href="${rel("contact/")}">Contact us and see your price</a></p>
    </main>
    <footer style="margin-top:32px;font-size:13px;color:#5d6f75">${esc(BRAND.name)} · ${esc(BRAND.tagline)} · Web, Android and iPhone</footer>
  </div>`;
}

function render(page) {
  let html = template;
  const nested = page.path !== "/";
  if (nested) html = html.replace(/(href|src)="\.\//g, '$1="../');
  const set = (re, val) => { html = html.replace(re, val); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  set(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(page.description)}"`);
  set(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${esc(page.title)}"`);
  set(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${esc(page.description)}"`);
  set(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${esc(page.title)}"`);
  set(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${esc(page.description)}"`);
  set(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${page.path === "/login/" ? "index, nofollow" : "index, follow, max-image-preview:large"}"`);
  set(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="__SITE_URL__${page.path}"`);
  set(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="__SITE_URL__${page.path}"`);
  html = html.replace(/<link rel="alternate" hreflang="(en-IN|x-default)" href="[^"]*"/g, `<link rel="alternate" hreflang="$1" href="__SITE_URL__${page.path}"`);
  const ld = jsonLd(page, "__SITE_URL__").map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n  ");
  // open the matching screen of the app on this URL (the app uses #/ routes)
  const open = page.path === "/" ? "" : `<script>if(!location.hash)history.replaceState(null,"",location.pathname+location.search+${JSON.stringify(page.hash)});</script>`;
  html = html.replace("<!--SEO:JSONLD-->", `${ld}\n  ${open}`);
  html = html.replace("<!--SEO:CONTENT-->", content(page));
  return html.replaceAll("__SITE_URL__", SITE);
}

for (const page of PUBLIC_PAGES) {
  const out = page.path === "/" ? join(dist, "index.html") : join(dist, page.path, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render(page));
}
writeFileSync(join(dist, "robots.txt"), `# EZY HR\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth-redirect.html\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${PUBLIC_PAGES.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority><xhtml:link rel="alternate" hreflang="en-IN" href="${SITE}${p.path}"/></url>`).join("\n")}\n</urlset>\n`);
console.log(`SEO: pre-rendered ${PUBLIC_PAGES.length} public pages, robots.txt and sitemap.xml (${SITE === "__SITE_URL__" ? "site URL filled in by the server per request — set SITE_URL for static hosting" : SITE})`);
