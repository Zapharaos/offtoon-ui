import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { TranslateLoader } from '@ngx-translate/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { of } from 'rxjs';

import { appConfig } from './app.config';

/**
 * Loader i18n côté serveur (prerender / SSG).
 *
 * Le `TranslateHttpLoader` du client va chercher `/assets/i18n/<lang>.json` par
 * HTTP, ce qui ne fonctionne pas pendant le prerender (aucun serveur ne sert les
 * assets, et l'intercepteur de prerender coupe HTTP). On lit donc le fichier
 * directement sur le disque pour que les titres/descriptions SEO (résolus via
 * i18n dans `SeoService`) soient corrects dans le HTML pré-rendu. Surcharge le
 * `TranslateLoader` de `appConfig` (le dernier gagne).
 */
class ServerTranslateLoader implements TranslateLoader {
  getTranslation(lang: string) {
    const file = join(process.cwd(), 'src', 'assets', 'i18n', `${lang}.json`);
    try {
      return of(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return of({});
    }
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    { provide: TranslateLoader, useClass: ServerTranslateLoader },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
