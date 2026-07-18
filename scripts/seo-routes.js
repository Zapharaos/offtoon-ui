/**
 * Source unique de vérité des pages publiques indexables.
 *
 * Consommée par `scripts/generate-seo.js` pour produire `src/sitemap.xml`
 * (soumis à Google Search Console) et `prerender-routes.txt` (config `ssg`).
 *
 * Offtoon est mono-locale (en-US, routes plates : `/`, `/privacy`, `/terms`).
 *
 * Ajouter une page publique indexable = ajouter une entrée dans `ROUTES` ici,
 * puis le `data.seo` de la route et les clés i18n `seo.*`.
 */
const SITE_URL = 'https://offtoon.freits.fr';

/**
 * Pages publiques indexables. `path: ''` = accueil (`/`).
 * @type {{path: string, changefreq: string, priority: number}[]}
 */
const ROUTES = [
  { path: '',        changefreq: 'weekly', priority: 1.0 },
  { path: 'terms',   changefreq: 'yearly', priority: 0.3 },
  { path: 'privacy', changefreq: 'yearly', priority: 0.3 },
];

module.exports = { SITE_URL, ROUTES };
