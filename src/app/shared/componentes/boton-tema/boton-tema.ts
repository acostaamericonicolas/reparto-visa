import { Component, inject } from '@angular/core';
import { Tema } from '../../../services/tema';

/** Sol/luna: muestra el tema al que se pasa al tocarlo. */
@Component({
  selector: 'app-boton-tema',
  template: `
    <button class="boton boton-chico tema" type="button" (click)="tema.alternar()"
            [attr.aria-label]="tema.actual() === 'oscuro' ? 'Pasar a tema claro' : 'Pasar a tema oscuro'"
            [title]="tema.actual() === 'oscuro' ? 'Pasar a tema claro' : 'Pasar a tema oscuro'">
      @if (tema.actual() === 'oscuro') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      }
    </button>
  `,
  styles: `
    .tema { display: inline-grid; place-items: center; padding: 4px 6px; line-height: 0; }
    svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `,
})
export class BotonTema {
  protected tema = inject(Tema);
}
