/**
 * Génère `src/sitemap.xml` et `prerender-routes.txt` à partir de la liste unique
 * `scripts/seo-routes.js`. Exécuté avant `ng build` (voir les scripts npm
 * "build" / "build:ssg").
 */
const fs = require('fs');
const path = require('path');
const { SITE_URL, ROUTES } = require('./seo-routes');

const root = path.join(__dirname, '..');
const today = new Date().toISOString().slice(0, 10);

// ── sitemap.xml ─────────────────────────────────────────────────────────────
// Une entrée <url> par page publique.
const blocks = ROUTES.map(
  (route) => `  <url>
    <loc>${SITE_URL}/${route.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`
);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blocks.join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(root, 'src', 'sitemap.xml'), sitemap, 'utf8');

// ── prerender-routes.txt (une route par ligne, pour la config `ssg`) ─────────
const prerenderRoutes = ROUTES.map((route) => `/${route.path}`);
fs.writeFileSync(
  path.join(root, 'prerender-routes.txt'),
  prerenderRoutes.join('\n') + '\n',
  'utf8'
);

console.log(
  `[generate-seo] ✔ sitemap.xml (${blocks.length} URLs) + prerender-routes.txt (${prerenderRoutes.length} routes) générés.`
);
