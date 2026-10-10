import { Component, computed, input } from '@angular/core';

/** Trazos (24×24, línea de 2) de cada icono de la app. Dibujados a mano para no depender de una fuente externa. */
const TRAZOS: Record<string, string> = {
  resumen: 'M4 4h16v16H4z M8 9h8 M8 13h8 M8 17h5',
  graficos: 'M4 20h16 M7 16v-5 M12 16V7 M17 16v-8',
  hogar: 'M4 11 12 4l8 7 M6 9.5V20h12V9.5 M10 20v-5h4v5',
  personas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14.8c1.8.7 3 2.6 3 5.2',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
  subir: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4',
  copiar: 'M9 9h11v11H9z M5 15H4V4h11v1',
  avisar: 'M21 3 10 14 M21 3l-7 18-4-7-7-4z',
  pago: 'M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6 10v4 M18 10v4',
  ok: 'M5 12.5l4.5 4.5L19 7.5',
  izquierda: 'M15 6l-6 6 6 6',
  derecha: 'M9 6l6 6-6 6',
  abajo: 'M6 9l6 6 6-6',
  lapiz: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  calendario: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  salir: 'M14 8V5H4v14h10v-3 M9 12h11 M17 9l3 3-3 3',
  tarjeta: 'M3 6h18v12H3z M3 10h18 M7 15h3',
};

/**
 * Icono de línea que toma el color del texto.
 * Uso: <app-icono nombre="copiar" /> — decorativo salvo que se pase `etiqueta`.
 */
@Component({
  selector: 'app-icono',
  template: `
    <svg viewBox="0 0 24 24" [attr.width]="tamano()" [attr.height]="tamano()"
         [attr.aria-hidden]="etiqueta() ? null : 'true'" [attr.aria-label]="etiqueta() || null" [attr.role]="etiqueta() ? 'img' : null">
      <path [attr.d]="trazo()" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; line-height: 0; flex: none; }
    svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `,
})
export class Icono {
  nombre = input.required<string>();
  tamano = input(18);
  etiqueta = input('');
  protected trazo = computed(() => TRAZOS[this.nombre()] ?? '');
}
