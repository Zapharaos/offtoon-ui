import {ApplicationConfig, isDevMode, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import {provideServiceWorker} from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';
import {provideTranslateService} from "@ngx-translate/core";
import {provideTranslateHttpLoader} from "@ngx-translate/http-loader";
import {IMAGE_LOADER, ImageLoaderConfig, IMAGE_CONFIG} from '@angular/common';

import { routes } from './app.routes';
import { DEFAULT_LOCALE } from "@core/services/locale.service";
import {PresetDefault} from '../assets/presets/default';
import {ConfirmationService, MessageService} from 'primeng/api';
import {environment} from '../environments/environment';
import {provideApi} from '@core/api';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {prerenderInterceptor} from '@core/interceptors/prerender.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([
      // prerenderInterceptor doit rester en premier (coupe HTTP au prerender).
      prerenderInterceptor,
    ])),
    provideApi(environment.apiUrl),
    providePrimeNG({
      theme: {
        preset: PresetDefault,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities'
          }
        }
      }
    }),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json'
      }),
      fallbackLang: DEFAULT_LOCALE,
      lang: DEFAULT_LOCALE
    }),
    {
      provide: LOCALE_ID, useValue: DEFAULT_LOCALE
    },
    {
      provide: IMAGE_LOADER,
      useValue: (config: ImageLoaderConfig) => {
        // For external URLs (LEGO, Bricklink), return as-is
        // NgOptimizedImage will handle the optimization
        return config.src;
      }
    },
    {
      provide: IMAGE_CONFIG,
      useValue: {
        disableImageSizeWarning: false,
        disableImageLazyLoadWarning: false
      }
    },
    MessageService,
    ConfirmationService,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // L'app doit fonctionner hors-ligne des la premiere visite : sur iOS une
      // web app ajoutee a l'ecran d'accueil possede son propre conteneur de
      // stockage, donc son SW doit s'installer pendant sa toute premiere
      // ouverture en ligne, qui peut durer moins de quelques secondes.
      // `registerWhenStable:30000` reportait l'enregistrement et laissait
      // l'app sans cache (ecran blanc au lancement suivant en mode avion).
      registrationStrategy: 'registerImmediately',
    }),
  ]
};
