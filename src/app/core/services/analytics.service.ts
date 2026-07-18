import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    umami?: {
      track(eventName: string, data?: Record<string, unknown>): void;
      track(callback: (props: Record<string, unknown>) => Record<string, unknown>): void;
    };
  }
}

/**
 * Injecte le script de tracking umami (self-hosted, cookieless) et expose
 * `track()` pour les événements custom.
 *
 * SSR-safe : no-op côté serveur / prerender (aucun script dans le HTML statique),
 * et no-op si `environment.umami.host`/`websiteId` sont vides (ex. prod avant
 * déploiement d'umami) - `track()` peut donc être appelé sans garde côté appelant.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private static readonly UTM_KEYS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'msclkid', 'twclid',
  ];

  /** À appeler une seule fois (depuis AppComponent). */
  init(): void {
    if (!this.isBrowser) return;

    const { host, websiteId, hostUrl } = environment.umami;
    if (!host || !websiteId) return;

    const utmData = this.extractAndCleanUtmParams();

    const scriptName = environment.umami.scriptName || 'script.js';

    const script = this.doc.createElement('script');
    script.defer = true;
    script.src = `${host.replace(/\/$/, '')}/${scriptName.replace(/^\//, '')}`;
    script.setAttribute('data-website-id', websiteId);
    script.setAttribute('data-auto-track', 'false');
    if (hostUrl) {
      script.setAttribute('data-host-url', hostUrl.replace(/\/$/, ''));
    }

    script.onload = () => {
      const w = this.doc.defaultView as Window & typeof globalThis;
      const cleanUrl = w.location.pathname + w.location.search + w.location.hash;
      w.umami?.track(props => ({ ...props, url: cleanUrl, ...utmData }));
    };

    this.doc.head.appendChild(script);
  }

  private extractAndCleanUtmParams(): Record<string, string> {
    const w = this.doc.defaultView as Window & typeof globalThis;
    const url = new URL(w.location.href);
    const utmData: Record<string, string> = {};

    for (const key of AnalyticsService.UTM_KEYS) {
      const value = url.searchParams.get(key);
      if (value) {
        utmData[key] = value;
        url.searchParams.delete(key);
      }
    }

    if (Object.keys(utmData).length > 0) {
      w.history.replaceState({}, '', url.toString());
    }

    return utmData;
  }

  /** Enregistre un événement custom. Sûr à appeler sans condition - no-op tant que le script umami n'est pas chargé. */
  track(eventName: string, data?: Record<string, unknown>): void {
    if (!this.isBrowser) return;
    this.doc.defaultView?.umami?.track(eventName, data);
  }

  /**
   * Enregistre un clic sortant vers un site source, en classant l'URL par hôte
   * (ex. `outbound-asurascans` / `outbound-other`).
   * @param context d'où vient le clic (ex. 'toon')
   */
  trackOutbound(url: string | null | undefined, context: string): void {
    if (!url) return;
    let target = 'other';
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      // Ex. "asurascans.com" → "asurascans" ; "api.asurascans.com" → "asurascans".
      const parts = host.split('.');
      target = parts.length >= 2 ? parts[parts.length - 2] : host;
    } catch {
      // URL invalide → 'other'
    }
    this.track(`outbound-${target}`, { context });
  }
}
