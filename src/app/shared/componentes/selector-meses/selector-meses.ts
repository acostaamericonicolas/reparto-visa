import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icono } from '../icono/icono';

export interface OpcionMes {
  id: string;
  /** "Octubre 2026": se muestra en el mes elegido. */
  largo: string;
  /** "Oct": se muestra en los demás. */
  corto: string;
  /** Texto chico debajo (ej. "4 pend."), en color de aviso. */
  detalle?: string;
}

/**
 * Selector de meses tipo rueda: el elegido queda centrado y los demás a los costados.
 * Se desliza con el dedo (elige el que queda en el centro), se toca un mes o se usan las flechas.
 */
@Component({
  selector: 'app-selector-meses',
  imports: [Icono],
  templateUrl: './selector-meses.html',
  styleUrl: './selector-meses.css',
})
export class SelectorMeses {
  meses = input.required<OpcionMes[]>();
  actual = input<string | null>(null);
  elegir = output<string>();

  private tira = viewChild.required<ElementRef<HTMLElement>>('tira');
  protected indice = computed(() => this.meses().findIndex((m) => m.id === this.actual()));

  /**
   * Solo un deslizamiento hecho por la persona (dedo, rueda o mouse) elige otro mes. Los movimientos de la tira
   * por otras causas (centrar el elegido, cambiar el tamaño de la ventana) no cambian el mes.
   */
  private deslizando = false;
  private espera?: ReturnType<typeof setTimeout>;

  constructor() {
    // Cada vez que cambia el mes elegido (o la lista), se centra.
    afterRenderEffect(() => {
      const i = this.indice();
      this.meses();
      this.centrar(i, false);
    });
    // Si cambia el ancho (girar el celular, achicar la ventana), se vuelve a centrar el elegido.
    afterNextRender(() => {
      const observador = new ResizeObserver(() => this.centrar(this.indice(), false));
      observador.observe(this.tira().nativeElement);
      this.destruir.onDestroy(() => observador.disconnect());
    });
  }

  private destruir = inject(DestroyRef);

  private centrar(i: number, suave: boolean) {
    const tira = this.tira().nativeElement;
    const boton = tira.querySelectorAll<HTMLElement>('.mes')[i];
    if (!boton) return;
    tira.scrollTo({ left: boton.offsetLeft - tira.clientWidth / 2 + boton.offsetWidth / 2, behavior: suave ? 'smooth' : 'auto' });
  }

  /** La persona empezó a mover la tira (dedo, rueda o arrastre). */
  protected empezo() {
    this.deslizando = true;
  }

  protected tocar(i: number) {
    // Tocar un mes no es deslizar: el movimiento hasta centrarlo no tiene que elegir otro.
    this.deslizando = false;
    clearTimeout(this.espera);
    const m = this.meses()[i];
    if (m && m.id !== this.actual()) this.elegir.emit(m.id);
    else this.centrar(i, true);
  }

  protected mover(paso: number) {
    const i = Math.min(this.meses().length - 1, Math.max(0, this.indice() + paso));
    this.tocar(i);
  }

  /** Al terminar de deslizar, se elige el mes que quedó más cerca del centro. */
  protected alDeslizar() {
    if (!this.deslizando) return;
    clearTimeout(this.espera);
    this.espera = setTimeout(() => {
      const tira = this.tira().nativeElement;
      const centro = tira.scrollLeft + tira.clientWidth / 2;
      let mejor = -1;
      let distancia = Infinity;
      tira.querySelectorAll<HTMLElement>('.mes').forEach((b, i) => {
        const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - centro);
        if (d < distancia) {
          distancia = d;
          mejor = i;
        }
      });
      this.deslizando = false;
      if (mejor >= 0) this.tocar(mejor);
    }, 160);
  }
}
