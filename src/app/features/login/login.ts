import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Sesion } from '../../services/sesion';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected sesion = inject(Sesion);
  private router = inject(Router);
  /** Con `ng serve` (emuladores) se puede entrar con un mail de prueba, sin Google. */
  protected emuladores = environment.emuladores;

  constructor() {
    effect(() => {
      if (this.sesion.usuario()) this.router.navigateByUrl('/');
    });
  }

  protected entrarDePrueba(evento: Event, mail: string) {
    evento.preventDefault();
    this.sesion.entrarDePrueba(mail);
  }
}
