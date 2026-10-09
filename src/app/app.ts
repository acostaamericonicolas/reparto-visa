import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Datos } from './services/datos';
import { Sesion } from './services/sesion';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected sesion = inject(Sesion);
  protected datos = inject(Datos);
  private router = inject(Router);

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
    // Al cerrar sesión (o si la cuenta no tiene acceso) se vuelve al login.
    effect(() => {
      if (this.sesion.usuario() === null) this.router.navigateByUrl('/login');
    });
  }
}
