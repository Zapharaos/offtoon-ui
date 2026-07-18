# SEO - Offtoon frontend

How the frontend handles SEO: per-route meta / Open Graph, robots, a sitemap, and
structured data. Ported from BrickScanr and **simplified to Offtoon's single locale**
(`en-US`, flat routes: `/`, `/privacy`, `/terms`) - no `hreflang`, no locale prefix.

---

## Overview

SEO relies on **two layers**:

1. **Client-side (always on)** - `SeoService` updates `<title>`, meta, Open Graph,
   Twitter Card, canonical and the JSON-LD `BreadcrumbList` on every navigation. Google
   runs the JS at crawl time, so it sees these tags.
2. **Prerendering / SSG (`npm run build:ssg`)** - public pages are rendered to static
   HTML so the tags are present **without executing JS**. Needed for social crawlers
   (LinkedIn, Facebook, Slack, WhatsApp, X) that don't run JS.

Runtime is **static** (no Node server): `build:ssg` emits prerendered `index.html` files
under `dist/offtoon-ui/browser/{route}/…`; everything else is served as the SPA
(`index.csr.html` fallback by nginx).

---

## Key files

| File | Role |
|------|------|
| `src/app/core/services/seo.service.ts` | Per-route meta/OG/Twitter/canonical/breadcrumb |
| `src/app/modules/**/**.routes.ts` | `data.seo` on each indexable route |
| `src/assets/i18n/en-US.json` (`seo.*`) | Titles + descriptions (i18n) |
| `src/index.html` | Default meta + JSON-LD `WebApplication` |
| `scripts/seo-routes.js` | **Single source** of public indexable pages |
| `scripts/generate-seo.js` | Generates `src/sitemap.xml` + `prerender-routes.txt` |
| `src/robots.txt`, `src/sitemap.xsl` | Crawl rules + sitemap stylesheet (copied to root via `angular.json`) |
| `src/main.server.ts`, `src/app/app.config.server.ts` | Server bootstrap + filesystem i18n loader for prerender |
| `src/app/app.routes.server.ts` | Server render mode (all routes = Prerender) |
| `src/app/core/interceptors/prerender.interceptor.ts` | Short-circuits HTTP during prerender |

---

## 1. Per-route meta (`SeoService`)

Each indexable route carries its metadata in `data.seo`:

```ts
{ path: 'terms', component: TermsComponent,
  data: { seo: { titleKey: 'seo.terms.title', descKey: 'seo.terms.desc', index: true } } }
```

| Field | Type | Effect |
|-------|------|--------|
| `titleKey` | i18n key | `<title>` + `og:title` + `twitter:title` |
| `descKey` | i18n key | `meta description` + `og:description` + `twitter:description` |
| `index` | bool | `true` → `index, follow`; **absent/false → `noindex, nofollow`** |
| `canonical` | path | Override the canonical path |
| `image` | path | Page-specific OG/Twitter image |

**Important:** a route without `index: true` is **noindex by default** - this is why the
dynamic `toon/:source/:slug` pages (third-party content) are not indexed. Initialised once
in `app.component.ts` (`this.seo.init()`).

---

## 2. robots.txt & sitemap.xml

Served **at the site root** via the `angular.json` assets mapping.

- `src/robots.txt` - allows crawling, points to the sitemap.
- `src/sitemap.xml` - **generated** by `scripts/generate-seo.js`, do not edit by hand.
- `src/sitemap.xsl` - cosmetic stylesheet (styled HTML view in browsers; ignored by crawlers).

### Add / change an indexable public page

1. Add the entry in **`scripts/seo-routes.js`** (`ROUTES`):
   ```js
   { path: 'new-page', changefreq: 'monthly', priority: 0.7 },
   ```
2. Add `data.seo` (with `index: true`) to the route.
3. Add `seo.newPage.title` / `.desc` in `src/assets/i18n/en-US.json`.
4. `npm run build` regenerates `sitemap.xml` + `prerender-routes.txt`.

---

## 3. Structured data (JSON-LD)

| Type | Where | Role |
|------|-------|------|
| `WebApplication` | `index.html` (static) | Declares Offtoon as a web app → rich results |
| `BreadcrumbList` | `SeoService` (dynamic) | `Home › Page` breadcrumb; absent on home & noindex pages |

---

## Build

```bash
npm run build       # CSR SPA: regenerate sitemap/prerender-routes THEN ng build
npm run build:ssg   # CSR + SSG prerender of the public pages (/ , /terms, /privacy)
npm run seo         # regenerate sitemap.xml + prerender-routes.txt on demand
```

`npm run build:ssg` relies on the `ssg` configuration in `angular.json`
(`server: src/main.server.ts` + `prerender.routesFile`). It outputs, per route, a real
`{route}/index.html` with resolved tags, plus `index.csr.html` (the SPA fallback shell).

### Keeping prerender SSR-safe

Prerender runs the bootstrap on Node (no browser DOM). Rules learned the hard way:

- **`BootstrapContext`** - `main.server.ts` must forward the SSR-engine context to
  `bootstrapApplication` (else `NG0401` "No platform exists!" on every route).
- **`provideServerRoutesConfig` / server render mode** - Angular 19 requires
  `app.routes.server.ts` (all routes `RenderMode.Prerender`). *(Note: it turned out the
  real fix was the `BootstrapContext`; the server routes file is scaffolded by `ng add`.)*
- **Synchronous providers** - use `provideAnimations()` (NOT `provideAnimationsAsync()`).
- **No unbounded async in the common path** - `LocaleService`'s locale-data dynamic import
  and `ScrollToTopComponent`'s `setTimeout` are guarded with `isPlatformBrowser`, otherwise
  the async outlives the render → `NG0401`.
- **Golden rule:** a component on a public (prerendered) page must not touch `window`,
  `document`, `localStorage`, timers, `IntersectionObserver`… in the constructor /
  `ngOnInit` / `ngAfterViewInit` without an `isPlatformBrowser` guard.

---

## Production checklist

- [ ] Confirm the canonical host (`environment.siteUrl`, `index.html`, `robots.txt`,
      `seo-routes.js`) - currently `https://offtoon.freits.fr`.
- [ ] **Deploy the `build:ssg` output** and set the nginx SPA fallback to `index.csr.html`
      (done in `offtoon-backend/nginx-front.conf`: `try_files $uri $uri/index.html $uri/ /index.csr.html;`).
- [ ] Submit the sitemap in Google Search Console.
- [ ] Add a dedicated **1200×630** Open Graph image and point `OG_IMAGE` in `seo.service.ts`
      + the `og:image` in `index.html` at it (currently falls back to `assets/img/logov3.png`).
