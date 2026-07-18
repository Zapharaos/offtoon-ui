import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY } from 'rxjs';

/**
 * Court-circuite toutes les requêtes HTTP pendant le prerender (SSG).
 *
 * Au prerender (côté Node), il n'y a pas d'utilisateur ni de backend joignable :
 * les appels d'API renverraient une erreur et feraient planter le rendu de la
 * route. Les données ne sont de toute façon pas nécessaires au HTML statique
 * (SEO) - le client refait les appels à l'hydratation.
 *
 * Doit être enregistré **en premier** dans la chaîne d'intercepteurs.
 * No-op dans le navigateur (laisse passer normalement).
 */
export const prerenderInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return EMPTY;
  }
  return next(req);
};
