import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/library-home/library-home.component').then(m => m.LibraryHomeComponent),
  },
  {
    path: 'read/:seriesId/:chapterId',
    loadComponent: () => import('./pages/reader/reader.component').then(m => m.ReaderComponent),
  },
];
