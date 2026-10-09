import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs';
import { Datos } from './services/datos';
import { Sesion } from './services/sesion';
import { BotonTema } from './shared/componentes/boton-tema/boton-tema';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BotonTema],
  templateUrl: './app.html',
  styleUrl: './app.css',
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
  /** "Resumen" queda marcado en / y en /?mes=... */
  protected enResumen = computed(() => this.url() === '/' || this.url().startsWith('/?'));

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

  protected recargar() {
    document.location.reload();
  }
}
