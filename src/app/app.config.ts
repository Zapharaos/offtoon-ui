import {ApplicationConfig, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
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
import {provideHttpClient} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideApi(environment.apiUrl),
    providePrimeNG({
      theme: {
        preset: PresetDefault,
        options: {
          darkModeSelector: '.dark',
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
  ]
};
