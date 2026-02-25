import { Routes } from '@angular/router';
import {HomeComponent} from "@modules/common/pages/home/home.component";

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'toon/:source/:slug',
    loadComponent: () => import('../toon/toon.component').then(m => m.ToonComponent)
  },
];
