export const environment = {
  production: false,
  tableSetHideIndex: false,
  apiUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000',
  // Base URL publique (gardée en prod pour des canonical/OG corrects même en dev).
  siteUrl: 'https://offtoon.freits.fr',
  umami: {
    // Instance umami locale (ex. docker). Laisser vide pour désactiver en dev.
    host: 'http://localhost:3001',
    websiteId: '',
    scriptName: 'script.js',
    hostUrl: ''
  }
};
