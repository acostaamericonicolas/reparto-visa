import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs';
import { Datos } from './services/datos';
import { Sesion } from './services/sesion';
import { BotonTema } from './shared/componentes/boton-tema/boton-tema';
import { Icono } from './shared/componentes/icono/icono';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, BotonTema, Icono],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '(document:click)': 'cerrarMenuAfuera($event)' },
})
export class App {
  protected sesion = inject(Sesion);
  protected datos = inject(Datos);
  private router = inject(Router);
  private actualizaciones = inject(SwUpdate);

  /** Ya se descargó una versión nueva de la app; se usa al recargar. */
  protected hayVersionNueva = signal(false);

  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly secciones = [
    { ruta: '/', nombre: 'Resumen', icono: 'resumen' },
    { ruta: '/graficos', nombre: 'Gráficos', icono: 'graficos' },
    { ruta: '/hogar', nombre: 'Hogar', icono: 'hogar' },
    { ruta: '/personas', nombre: 'Personas', icono: 'personas' },
  ];

  /** Sección marcada: "Resumen" vale en / y en /?mes=...; las demás, por el comienzo de la ruta. */
  protected activa(ruta: string): boolean {
    const url = this.url();
    return ruta === '/' ? url === '/' || url.startsWith('/?') : url.startsWith(ruta);
  }

  constructor() {
    if (this.actualizaciones.isEnabled) {
      this.actualizaciones.versionUpdates
        .pipe(
          filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.hayVersionNueva.set(true));
    }
    // Al cerrar sesión (o si la cuenta no tiene acceso) se vuelve al login.
    effect(() => {
      if (this.sesion.usuario() === null) this.router.navigateByUrl('/login');
    });
  }

  /** El menú del engranaje se cierra al tocar en cualquier otro lado. */
  protected cerrarMenuAfuera(evento: Event) {
    const menu = document.querySelector<HTMLDetailsElement>('.menu-cuenta');
    if (menu?.open && !menu.contains(evento.target as Node)) menu.open = false;
  }

  protected recargar() {
    document.location.reload();
  }
}
