import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Page utilitaire **dev only** (`/og-preview`, gardée par `devOnlyGuard`).
 *
 * Affiche une carte au format exact **1200×630px** (ratio Open Graph 1.91:1)
 * servant de gabarit pour l'image de partage social.
 *
 * Générer l'image : ouvrir `/og-preview`, puis DevTools → clic droit sur
 * `div.og-card` → « Capture node screenshot ». Enregistrer en
 * `src/assets/img/og.png`, puis pointer `OG_IMAGE` (dans `seo.service.ts`) et
 * `og:image` (dans `index.html`) vers `assets/img/og.png`.
 *
 * Thème sombre, aligné sur l'appli ; accent vert sauge (primary #709775).
 */
@Component({
  selector: 'app-og-preview',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="og-wrapper">
      <p class="og-hint">
        Gabarit OG - 1200×630px. DevTools → clic droit sur la carte →
        « Capture node screenshot », puis enregistrer en
        <code>src/assets/img/og.png</code>.
      </p>

      <div class="og-card">
        <!-- halo décoratif -->
        <div class="og-glow"></div>

        <!-- marque : logo + nom -->
        <div class="og-brand">
          <img class="og-logo" src="assets/img/logov3.png" alt="Offtoon" />
          <span class="og-name">Offtoon</span>
        </div>

        <!-- accroche -->
        <h1 class="og-title">{{ 'seo.og.title' | translate }}</h1>
        <p class="og-sub">{{ 'seo.og.subtitle' | translate }}</p>

        <!-- pied -->
        <div class="og-foot">
          <span class="og-bar"></span>
          <span class="og-url">offtoon.freits.fr</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .og-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
      min-height: 100vh;
      background: #0a0a0a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .og-hint {
      color: #a3a3a3;
      font-size: 13px;
      text-align: center;
      max-width: 1200px;
      line-height: 1.5;
    }
    .og-hint code {
      color: #fafafa;
      background: rgba(255,255,255,0.08);
      padding: 1px 6px;
      border-radius: 4px;
    }

    /* La carte EXACTE 1200×630 - c'est ce nœud qu'il faut capturer. */
    .og-card {
      position: relative;
      width: 1200px;
      height: 630px;
      flex: none;
      overflow: hidden;
      box-sizing: border-box;
      padding: 84px 96px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background:
        radial-gradient(120% 140% at 100% 0%, #1c261e 0%, rgba(28,38,30,0) 55%),
        linear-gradient(160deg, #18181b 0%, #0f0f11 100%);
      color: #fafafa;
    }

    .og-glow {
      position: absolute;
      top: -170px;
      right: -120px;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(112,151,117,0.30) 0%, rgba(112,151,117,0) 70%);
      pointer-events: none;
    }

    .og-brand {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 40px;
      position: relative;
    }
    .og-logo {
      width: 60px;
      height: 60px;
      object-fit: contain;
    }
    .og-name {
      font-size: 46px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fafafa;
    }

    .og-title {
      position: relative;
      margin: 0 0 28px;
      font-size: 66px;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -1.5px;
      color: #ffffff;
      max-width: 980px;
    }

    .og-sub {
      position: relative;
      margin: 0;
      font-size: 28px;
      line-height: 1.45;
      font-weight: 500;
      color: #a1a1aa;
      max-width: 920px;
    }

    .og-foot {
      position: absolute;
      left: 96px;
      bottom: 64px;
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .og-bar {
      width: 56px;
      height: 6px;
      border-radius: 3px;
      background: #8FB996;
    }
    .og-url {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: #8FB996;
    }
  `],
})
export class OgPreviewComponent {}
