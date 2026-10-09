import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { valorCss } from '../../colores';
import { formatoMonto } from '../../montos';

Chart.register(...registerables);

/** Gráfico de torta: cada porción con su monto y su porcentaje del total. Los colores son variables CSS (ej. "var(--p1)"). */
@Component({
  selector: 'app-grafico-torta',
  template: '<div class="lienzo"><canvas #lienzo [attr.aria-label]="descripcion()" role="img"></canvas></div>',
  styles: '.lienzo { position: relative; height: 280px; } @media (max-width: 600px) { .lienzo { height: 240px; } }',
})
export class GraficoTorta implements OnDestroy {
  etiquetas = input.required<string[]>();
  valores = input.required<number[]>();
  colores = input.required<string[]>();
  prefijo = input('$ ');
  descripcion = input('');

  private lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico?: Chart;

  constructor() {
    effect(() => this.dibujar());
  }

  private dibujar() {
    const valores = this.valores().map((v) => Math.max(0, v));
    const total = valores.reduce((s, v) => s + v, 0);
    const prefijo = this.prefijo();
    const porcentaje = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1).replace('.', ',') : '0') + '%';

    this.grafico?.destroy();
    this.grafico = new Chart(this.lienzo().nativeElement, {
      type: 'pie',
      data: {
        labels: this.etiquetas().map((e, i) => `${e} · ${porcentaje(valores[i] ?? 0)}`),
        datasets: [
          {
            data: valores,
            backgroundColor: this.colores().map((c) => valorCss(c)),
            borderColor: valorCss('var(--superficie)'),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: valorCss('var(--texto-2)'), boxWidth: 12 } },
          tooltip: { callbacks: { label: (c) => ` ${prefijo}${formatoMonto(c.parsed)} (${porcentaje(c.parsed)})` } },
        },
      },
    });
  }

  ngOnDestroy() {
    this.grafico?.destroy();
  }
}
