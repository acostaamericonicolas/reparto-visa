import { Injectable, computed, signal } from '@angular/core';

export type ModoTema = 'claro' | 'oscuro';

const CLAVE = 'tema';

/**
 * Tema claro u oscuro. Sin elección sigue al sistema (y cambia si cambia el sistema).
 * La elección se guarda en este dispositivo; public/tema.js la aplica antes de que se dibuje la página.
 */
@Injectable({ providedIn: 'root' })
export class Tema {
  private consulta = window.matchMedia('(prefers-color-scheme: dark)');
  private sistema = signal<ModoTema>(this.consulta.matches ? 'oscuro' : 'claro');
  /** Lo que eligió la persona con el sol/luna; null = sigue al sistema. */
  readonly elegido = signal<ModoTema | null>(leer());
  /** El tema que se ve ahora. */
  readonly actual = computed<ModoTema>(() => this.elegido() ?? this.sistema());

  constructor() {
    this.consulta.addEventListener('change', (e) => this.sistema.set(e.matches ? 'oscuro' : 'claro'));
  }

  /** Pasa al tema contrario. Si queda igual al del sistema, vuelve a seguir al sistema. */
  alternar() {
    const nuevo: ModoTema = this.actual() === 'oscuro' ? 'claro' : 'oscuro';
    const elegido = nuevo === this.sistema() ? null : nuevo;
    this.elegido.set(elegido);
    if (elegido) document.documentElement.setAttribute('data-tema', elegido);
    else document.documentElement.removeAttribute('data-tema');
    try {
      if (elegido) localStorage.setItem(CLAVE, elegido);
      else localStorage.removeItem(CLAVE);
    } catch {
      // Sin almacenamiento (modo privado): el tema vale hasta cerrar la pestaña.
    }
  }
}

function leer(): ModoTema | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'claro' || v === 'oscuro' ? v : null;
  } catch {
    return null;
  }
}
