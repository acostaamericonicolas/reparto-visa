import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartDataset, registerables } from 'chart.js';
import { valorCss } from '../../colores';
import { formatoMonto } from '../../montos';

Chart.register(...registerables);

const COMPACTO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** Eje vertical: 1400000 → "1,4 M", 900000 → "900 k" (el monto exacto está en el tooltip). */
function abreviado(v: number): string {
  if (Math.abs(v) >= 1_000_000) return COMPACTO.format(v / 1_000_000) + ' M';
  if (Math.abs(v) >= 1_000) return COMPACTO.format(v / 1_000) + ' k';
  return COMPACTO.format(v);
}

/** Una serie del gráfico. `color` es una variable CSS (ej. "var(--p1)"). */
export interface SerieGrafico {
  nombre: string;
  datos: (number | null)[];
  color: string;
  /** Línea sobre un gráfico de barras (ej. el total o lo que informa el banco). */
  linea?: boolean;
  punteada?: boolean;
}

/** Envoltorio de Chart.js: barras apiladas por persona, con líneas opcionales encima. */
@Component({
  selector: 'app-grafico',
  template: '<div class="lienzo"><canvas #lienzo [attr.aria-label]="descripcion()" role="img"></canvas></div>',
  styles: '.lienzo { position: relative; height: 320px; } @media (max-width: 600px) { .lienzo { height: 260px; } }',
})
export class Grafico implements OnDestroy {
  etiquetas = input.required<string[]>();
  series = input.required<SerieGrafico[]>();
  tipo = input<'barras' | 'lineas'>('barras');
  apilado = input(true);
  prefijo = input('$ ');
  descripcion = input('');

  private lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico?: Chart;

  constructor() {
    effect(() => this.dibujar());
  }

  private dibujar() {
    const barras = this.tipo() === 'barras';
    const prefijo = this.prefijo();
    const texto = valorCss('var(--texto-2)');
    const grilla = valorCss('var(--linea)');

    const datasets = this.series().map((s): ChartDataset<'bar' | 'line', (number | null)[]> => {
      const color = valorCss(s.color);
      const comoLinea = !barras || s.linea;
      return {
        type: comoLinea ? 'line' : 'bar',
        label: s.nombre,
        data: s.datos,
        backgroundColor: comoLinea ? color : color + 'cc',
        borderColor: color,
        borderWidth: comoLinea ? 2 : 0,
        borderDash: s.punteada ? [6, 4] : [],
        pointRadius: comoLinea ? 3 : 0,
        tension: 0.25,
        spanGaps: true,
        // Las líneas de referencia no se apilan con las barras.
        stack: s.linea ? 'linea-' + s.nombre : 'barras',
        order: s.linea ? 0 : 1,
      };
    });

    this.grafico?.destroy();
    this.grafico = new Chart(this.lienzo().nativeElement, {
      type: barras ? 'bar' : 'line',
      data: { labels: this.etiquetas(), datasets: datasets as ChartDataset<'bar'>[] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          // Sin etiquetas inclinadas: en pantallas chicas Chart.js saltea meses en vez de girarlos.
          x: { stacked: barras && this.apilado(), ticks: { color: texto, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
          y: {
            stacked: barras && this.apilado(),
            ticks: { color: texto, callback: (v) => prefijo + abreviado(Number(v)) },
            grid: { color: grilla },
          },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: texto, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (c) => (c.parsed.y === null ? '' : ` ${c.dataset.label}: ${prefijo}${formatoMonto(c.parsed.y)}`),
            },
          },
        },
      },
    });
  }

  ngOnDestroy() {
    this.grafico?.destroy();
  }
}
