/**
 * Locale configuration for URL-based locale routing
 *
 * This mimics LEGO's locale system where:
 * - URL format: /[language]-[region]
 * - language: Display language for UI text
 * - region: Determines currency and regional settings
 *
 * Examples:
 * - /en-us: English UI, US region (USD)
 * - /fr-fr: French UI, French region (EUR)
 * - /en-fr: English UI, French region (EUR) - unusual but valid
 */

export interface LocaleConfig {
  urlPath: string;          // URL path segment (e.g., 'en-us')
  language: string;         // UI language code (e.g., 'en')
  region: string;           // Region code (e.g., 'US')
  acceptLanguage: string;   // Accept-Language header value
  xLocale: string;          // X-Locale header value (LEGO's custom header)
  currency: string;         // Currency code (e.g., 'USD')
  displayLabel: string;     // Display name for UI
  angularLocale: string;    // Angular locale code for date/number formatting
  translationFile: string;  // Translation file name (e.g., 'en-US', 'fr-FR')
  angularLocaleModule: () => Promise<any>; // Angular locale module loader
}

export const VALID_LOCALES: LocaleConfig[] = [
  {
    urlPath: 'en-us',
    language: 'en',
    region: 'US',
    acceptLanguage: 'en-US',
    xLocale: 'en-US',
    currency: 'USD',
    displayLabel: 'English (US)',
    angularLocale: 'en-US',
    translationFile: 'en-US',
    angularLocaleModule: () => import('@angular/common/locales/en')
  },
];

export const DEFAULT_LOCALE_CONFIG = VALID_LOCALES[0];

/**
 * Get locale config by URL path
 */
export function getLocaleConfig(urlPath: string): LocaleConfig | undefined {
  return VALID_LOCALES.find(l => l.urlPath === urlPath.toLowerCase());
}

/**
 * Check if a URL path is a valid locale
 */
export function isValidLocale(urlPath: string): boolean {
  return getLocaleConfig(urlPath) !== undefined;
}

/**
 * Detect the best matching locale URL path from the browser's language preferences.
 *
 * Strategy (in order):
 * 1. Exact match against navigator.languages  (e.g. "fr-FR" → "fr-fr")
 * 2. Language-only match                      (e.g. "de"    → "de-de")
 * 3. Falls back to the default locale         (en-us)
 */
export function detectBrowserLocale(): string {
  const languages: readonly string[] =
    navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const lang of languages) {
    const lower = lang.toLowerCase();

    // 1. Exact match (e.g. "fr-fr")
    const exact = VALID_LOCALES.find(l => l.urlPath === lower);
    if (exact) return exact.urlPath;

    // 2. Language-only prefix match (e.g. "de" matches "de-de")
    const languageCode = lower.split('-')[0];
    const byLanguage = VALID_LOCALES.find(l => l.language === languageCode);
    if (byLanguage) return byLanguage.urlPath;
  }

  return DEFAULT_LOCALE_CONFIG.urlPath;
}

