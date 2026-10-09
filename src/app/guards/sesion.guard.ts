import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Sesion } from '../services/sesion';

// inject() solo funciona antes del primer await: por eso Router se pide al principio.

/** Solo con sesión iniciada; si no, al login. */
export const conSesion: CanActivateFn = async () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  await sesion.inicializado;
  return sesion.usuario() ? true : router.createUrlTree(['/login']);
};

/** El login solo se ve sin sesión; con sesión, a la app. */
export const sinSesion: CanActivateFn = async () => {
  const sesion = inject(Sesion);
  const router = inject(Router);
  await sesion.inicializado;
  return sesion.usuario() ? router.createUrlTree(['/']) : true;
};
