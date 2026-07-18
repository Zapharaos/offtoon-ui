import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import {HomeComponent} from "@modules/common/pages/home/home.component";
import {environment} from '../../../environments/environment';

/** Pages dev-only : accessibles en dev uniquement ; en prod → redirige vers l'accueil. */
const devOnlyGuard = () =>
  environment.production ? inject(Router).parseUrl('/') : true;

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    data: { seo: { titleKey: 'seo.home.title', descKey: 'seo.home.desc', index: true } }
  },
  {
    // Pas de `data.seo` → noindex par défaut (pages de contenu tierces, non indexées).
    path: 'toon/:source/:slug',
    loadComponent: () => import('../toon/toon.component').then(m => m.ToonComponent)
  },
  {
    // Gabarit OG dev-only - non indexé (pas de data.seo.index), bloqué en prod.
    path: 'og-preview',
    canActivate: [devOnlyGuard],
    loadComponent: () => import('@modules/common/pages/og-preview/og-preview.component').then(m => m.OgPreviewComponent),
  },
];
