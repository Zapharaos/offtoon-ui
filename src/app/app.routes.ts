import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./modules/common/common.routes').then(m => m.routes),
  },
  {
    path: '**',
    loadComponent: () => import('./modules/common/pages/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
