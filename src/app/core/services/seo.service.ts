import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * Métadonnées SEO portées par la `data` d'une route.
 *
 * Exemple : `data: { seo: { titleKey: 'seo.terms.title', descKey: 'seo.terms.desc', index: true } }`
 *
 * - `index: true`  → la page est indexable (sinon `noindex, nofollow` par défaut).
 * - `canonical`    → override du chemin canonique (ex. `terms`).
 * - `image`        → image OG/Twitter spécifique (chemin relatif).
 */
export interface SeoData {
  titleKey?: string;
  descKey?: string;
  index?: boolean;
  canonical?: string;
  image?: string;
}

const SITE_NAME = 'Offtoon';

/** Langue du document (offtoon est mono-locale : en). */
const HTML_LANG = 'en';

/** Balise Open Graph de langue. */
const OG_LOCALE = 'en_US';

/** Image OG/Twitter par défaut (carte 1200×630 dédiée). */
const OG_IMAGE = 'assets/img/og.png';

/** Texte alternatif de l'image OG (complète le nom du site). */
const OG_IMAGE_ALT = 'Download webtoons, manhwa & manhua';

/**
 * Applique les métadonnées SEO (title, description, Open Graph, Twitter,
 * canonical, robots, JSON-LD BreadcrumbList) à chaque navigation, à partir de la
 * `data.seo` de la route active. Offtoon étant mono-locale, il n'y a ni préfixe
 * de langue ni liens `hreflang` (contrairement à brick-scanr multi-locale).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly baseUrl = environment.siteUrl.replace(/\/$/, '');

  /** À appeler une seule fois (depuis AppComponent). S'abonne aux fins de navigation. */
  init(): void {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        const url = (e as NavigationEnd).urlAfterRedirects ?? (e as NavigationEnd).url ?? '/';
        this.apply(this.deepestSeo(), url);
      });

    // Dans le navigateur, le fichier de langue est chargé de façon asynchrone :
    // on ré-applique à chaque changement de langue pour la route courante.
    this.translate.onLangChange.subscribe(() => {
      this.apply(this.deepestSeo(), this.router.url);
    });

    // La navigation initiale peut s'être terminée avant cet abonnement.
    if (this.router.navigated) {
      this.apply(this.deepestSeo(), this.router.url);
    }
  }

  /** Remonte la `data.seo` de la route active la plus profonde. */
  private deepestSeo(): SeoData {
    let route: ActivatedRoute | null = this.activatedRoute.firstChild;
    while (route?.firstChild) route = route.firstChild;
    return (route?.snapshot.data?.['seo'] as SeoData) ?? {};
  }

  private apply(seo: SeoData, url: string): void {
    const path = url.split('#')[0].split('?')[0].replace(/^\/+/, '');
    this.doc.documentElement.lang = HTML_LANG;

    const canonical = this.absoluteUrl(seo.canonical ?? path);
    const image = this.absolute(seo.image ?? OG_IMAGE);
    const isIndexable = seo.index === true;

    // robots - par défaut on désindexe tout ce qui n'est pas explicitement public.
    this.meta.updateTag({
      name: 'robots',
      content: isIndexable ? 'index, follow' : 'noindex, nofollow',
    });
    this.setCanonical(canonical);

    // Communs (présents quelle que soit la page)
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:locale', content: OG_LOCALE });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:image:alt', content: `${SITE_NAME} - ${OG_IMAGE_ALT}` });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    const titleKey = seo.titleKey ?? 'seo.default.title';
    const descKey = seo.descKey ?? 'seo.default.desc';

    // Au prerender (serveur), les traductions sont résolues de façon synchrone
    // (loader filesystem) - on utilise `instant` pour ne pas laisser une
    // souscription asynchrone se résoudre après la destruction de la plateforme
    // (sinon NG0401). Dans le navigateur, si le fichier de langue n'est pas encore
    // chargé, on retombe sur la résolution asynchrone.
    if (!this.isBrowser || this.translate.instant(titleKey) !== titleKey) {
      this.applyTitles(
        path,
        this.translate.instant(titleKey),
        this.translate.instant(descKey),
        this.translate.instant('seo.breadcrumb.home'),
        titleKey, descKey, isIndexable,
      );
      return;
    }

    forkJoin({
      title: this.translate.get(titleKey),
      desc: this.translate.get(descKey),
      homeLabel: this.translate.get('seo.breadcrumb.home'),
    }).subscribe(({ title, desc, homeLabel }) => {
      this.applyTitles(path, title, desc, homeLabel, titleKey, descKey, isIndexable);
    });
  }

  private applyTitles(
    path: string, title: string, desc: string, homeLabel: string,
    titleKey: string, descKey: string, isIndexable: boolean,
  ): void {
    // Si la clé n'existe pas, ngx-translate renvoie la clé : on retombe sur le nom du site.
    const pageTitle = title && title !== titleKey ? title : SITE_NAME;
    const description = desc && desc !== descKey ? desc : '';

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    this.setBreadcrumb(path, pageTitle, homeLabel, isIndexable);
  }

  /**
   * Fil d'Ariane JSON-LD (Schema.org `BreadcrumbList`).
   * Pages publiques plates → 2 niveaux : Accueil > Page courante.
   * Retiré sur l'accueil et les pages non indexées.
   */
  private setBreadcrumb(path: string, pageTitle: string, homeLabel: string, isIndexable: boolean): void {
    if (!isIndexable || path === '') {
      this.removeJsonLd('seo-breadcrumb');
      return;
    }
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: homeLabel, item: this.absoluteUrl('') },
        { '@type': 'ListItem', position: 2, name: pageTitle, item: this.absoluteUrl(path) },
      ],
    };
    this.setJsonLd('seo-breadcrumb', data);
  }

  private setJsonLd(id: string, data: unknown): void {
    let script = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = this.doc.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      this.doc.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  private removeJsonLd(id: string): void {
    this.doc.getElementById(id)?.remove();
  }

  /** URL absolue d'une page : `{base}/{rest}` (racine si `rest` vide). */
  private absoluteUrl(rest: string): string {
    const clean = rest.replace(/^\/+/, '');
    return clean ? `${this.baseUrl}/${clean}` : `${this.baseUrl}/`;
  }

  private absolute(pathOrUrl: string): string {
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    return this.baseUrl + '/' + pathOrUrl.replace(/^\//, '');
  }

  private setCanonical(href: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}
