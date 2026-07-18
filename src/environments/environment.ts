export const environment = {
  production: true,
  tableSetHideIndex: true,
  apiUrl: 'https://api-offtoon.freits.fr',
  wsUrl: 'wss://api-offtoon.freits.fr',
  // Base URL publique du site (canonical, og:url, sitemap).
  siteUrl: 'https://offtoon.freits.fr',
  umami: {
    // Montage first-party (anti-adblock) : le script et la collecte passent par
    // le domaine du site, proxifiés vers umami par le nginx (voir nginx-front.conf).
    host: 'https://offtoon.freits.fr',
    // À créer dans le dashboard umami PROD (Settings → Websites), puis coller le
    // websiteId ici. Tant qu'il est vide, aucun script n'est injecté.
    websiteId: '19776a1b-fd64-44f0-969e-2dd192390475',
    // Nom du script tracker (doit correspondre au proxy nginx `location = /stats.js`).
    scriptName: 'stats.js',
    // First-party : domaine vers lequel le script envoie les events (data-host-url).
    // Vide = envoi direct vers `host`.
    hostUrl: 'https://offtoon.freits.fr'
  }
};
