import { Injectable, Inject, LOCALE_ID, PLATFORM_ID, inject } from '@angular/core';
import {isPlatformBrowser, registerLocaleData} from "@angular/common";
import {TranslateService} from "@ngx-translate/core";
import { VALID_LOCALES, DEFAULT_LOCALE_CONFIG, getLocaleConfig, LocaleConfig } from '@core/config/locale.config';

// Default locale constant that can be used in app.config.ts
export const DEFAULT_LOCALE = DEFAULT_LOCALE_CONFIG.angularLocale;

@Injectable({
  providedIn: 'root'
})
export class LocaleService {
  private loadedAngularLocales = new Set<string>();
  private currentLocaleConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(@Inject(LOCALE_ID) private localeId: string) {
    // Validate that the injected LOCALE_ID matches our default
    if (localeId !== DEFAULT_LOCALE) {
      console.warn(`LOCALE_ID (${localeId}) doesn't match DEFAULT_LOCALE (${DEFAULT_LOCALE}). Using DEFAULT_LOCALE.`);
    }

    // Initialize default locale in background (intentionally not awaited).
    // Browser-only : le dynamic import de locale est async et ferait échouer le
    // prerender (NG0401 « async qui survit au rendu »). en-US par défaut suffit au SSG.
    if (this.isBrowser) {
      void this.initializeDefaultLocale();
    }
  }

  /**
   * Initialize the default locale synchronously at service creation
   * This prevents runtime errors when Angular tries to use date pipes immediately
   */
  private async initializeDefaultLocale(): Promise<void> {
    try {
      await this.loadAngularLocale(DEFAULT_LOCALE_CONFIG.angularLocale);
    } catch (error) {
      console.error('Failed to load default locale:', error);
    }
  }

  /**
   * Set locale from URL path (e.g., 'en-us', 'fr-fr')
   */
  setLocaleFromUrl(urlPath: string): void {
    const config = getLocaleConfig(urlPath);
    if (!config) {
      console.warn(`Invalid locale path: ${urlPath}, using default`);
      this.currentLocaleConfig = DEFAULT_LOCALE_CONFIG;
      return;
    }

    this.currentLocaleConfig = config;

    // Load Angular locale data
    this.loadAngularLocale(config.angularLocale).catch(error => {
      console.error('Failed to load Angular locale:', error);
    });
  }

  /**
   * Get the current locale configuration
   */
  getCurrentLocaleConfig(): LocaleConfig {
    return this.currentLocaleConfig;
  }

  /**
   * Get Accept-Language header value for current locale
   */
  getAcceptLanguage(): string {
    return this.currentLocaleConfig.acceptLanguage;
  }

  /**
   * Get X-Locale header value for current locale
   */
  getXLocale(): string {
    return this.currentLocaleConfig.xLocale;
  }

  /**
   * Get currency for current locale
   */
  getCurrency(): string {
    return this.currentLocaleConfig.currency;
  }

  /**
   * Get URL path for current locale
   */
  getUrlPath(): string {
    return this.currentLocaleConfig.urlPath;
  }

  /**
   * Get UI language code for current locale
   */
  getLanguage(): string {
    return this.currentLocaleConfig.language;
  }

  /**
   * Get translation file name for current locale (e.g., 'en-US', 'fr-FR')
   */
  getTranslationFile(): string {
    return this.currentLocaleConfig.translationFile;
  }

  // Get all available locales for UI display
  getAvailableLocales(): Array<{code: string, label: string, currency: string}> {
    return VALID_LOCALES.map(config => ({
      code: config.urlPath,
      label: config.displayLabel,
      currency: config.currency
    }));
  }

  // Helper method to check if a locale code is supported
  isSupportedLocale(localeCode: string): boolean {
    return getLocaleConfig(localeCode) !== undefined;
  }

  // Get all supported locale codes
  getSupportedLocaleCodes(): string[] {
    return VALID_LOCALES.map(config => config.urlPath);
  }

  /**
   * Dynamically load and register Angular locale data when needed
   */
  async loadAngularLocale(angularLocale: string): Promise<void> {
    // Skip if already loaded
    if (this.loadedAngularLocales.has(angularLocale)) {
      return;
    }

    const config = VALID_LOCALES.find(c => c.angularLocale === angularLocale);
    if (!config) {
      console.warn(`Angular locale ${angularLocale} not supported`);
      return;
    }

    try {
      // Dynamically import the locale data
      const localeModule = await config.angularLocaleModule();
      const localeData = localeModule.default;

      // Register the locale data
      registerLocaleData(localeData, angularLocale);
      this.loadedAngularLocales.add(angularLocale);
    } catch (error) {
      console.error(`Failed to load Angular locale data for ${angularLocale}:`, error);
    }
  }

  /**
   * Generate a PrimeNG-compatible date format string based on the current locale
   * @returns A date format string like 'dd.mm.yy' or 'mm/dd/yy'
   */
  getPrimeNGDateFormat(): string {
    const sampleDate = new Date(2023, 11, 25);
    const formatter = new Intl.DateTimeFormat(this.currentLocaleConfig.angularLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(sampleDate);
    let format = '';

    for (const part of parts) {
      switch (part.type) {
        case 'day':
          format += 'dd';
          break;
        case 'month':
          format += 'mm';
          break;
        case 'year':
          format += 'yy';
          break;
        case 'literal':
          format += part.value;
          break;
      }
    }

    return format || 'dd.mm.yy';
  }

  /**
   * Determine if a locale uses 12-hour or 24-hour format based on natural formatting
   * @returns '12' if the locale uses 12-hour format, '24' for 24-hour format
   */
  getHourFormat(): string {
    const sampleDate = new Date(2023, 11, 25, 14, 30);
    const formatter = new Intl.DateTimeFormat(this.currentLocaleConfig.angularLocale, {
      hour: 'numeric',
      minute: '2-digit'
    });

    const formatted = formatter.format(sampleDate);
    const amPmIndicators = ['AM', 'PM', 'am', 'pm', 'a.m.', 'p.m.', 'de', 'du', 'vorm.', 'nachm.'];
    const uses12Hour = amPmIndicators.some(indicator => formatted.includes(indicator));

    return uses12Hour ? '12' : '24';
  }

  /**
   * Format a Date object to a time string based on the current locale
   * @param date The date to format
   * @param options Optional Intl.DateTimeFormatOptions for custom formatting
   * @returns Formatted time string
   */
  formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
    if (!options) {
      options = {
        hour: '2-digit',
        minute: '2-digit',
      };
    }
    return date.toLocaleTimeString(this.currentLocaleConfig.angularLocale, options);
  }

  /**
   * Format a Date object to a date string based on the current locale
   * @param date The date to format
   * @param options Optional Intl.DateTimeFormatOptions for custom formatting
   * @returns Formatted date string
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    if (!options) {
      options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      };
    }
    return date.toLocaleDateString(this.currentLocaleConfig.angularLocale, options);
  }
}
