import { Routes } from '@angular/router';
import { conSesion, sinSesion } from './guards/sesion.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [sinSesion], loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [conSesion],
    children: [
      // El mes elegido va como ?mes=fecha-de-cierre: una sola ruta, así la página no se recrea al cambiar de mes.
      { path: '', pathMatch: 'full', loadComponent: () => import('./features/resumen/resumen').then((m) => m.Resumen) },
      { path: 'graficos', loadComponent: () => import('./features/graficos/graficos').then((m) => m.Graficos) },
      { path: 'personas', loadComponent: () => import('./features/personas/personas').then((m) => m.Personas) },
    ],
  },
  { path: '**', redirectTo: '' },
];
