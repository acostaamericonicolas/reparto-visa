import { Component, computed, inject } from '@angular/core';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Hogar } from '../../../services/hogar';
import { Grafico, SerieGrafico } from '../../../shared/componentes/grafico/grafico';
import { mesCorto, nombreMes } from '../../../shared/fechas';
import { calcularMes, estimadoVsReal } from '../../../shared/hogar';
import { r2 } from '../../../shared/montos';

/** Evolución de los gastos del hogar mes a mes, con barras lado a lado para poder compararlas. */
@Component({
  selector: 'app-historial-hogar',
  imports: [PesosPipe, Grafico],
  templateUrl: './historial.html',
  styleUrl: './historial.css',
})
export class HistorialHogar {
  private hogar = inject(Hogar);

  protected meses = computed(() =>
    this.hogar.ids().map((id) => {
      const m = this.hogar.meses()[id];
      return { id, nombre: nombreMes(id + '-01'), corto: mesCorto(id + '-01'), r: calcularMes(m), evv: estimadoVsReal(m), m };
    }),
  );
  /** Del más nuevo al más viejo, para la tabla. */
  protected tabla = computed(() => [...this.meses()].reverse());
  protected etiquetas = computed(() => this.meses().map((x) => x.corto));

  protected totalUsd = computed(() => this.meses().reduce((s, x) => s + x.r.usd, 0));
  private promedio = (f: (x: ReturnType<HistorialHogar['meses']>[number]) => number) =>
    this.meses().length ? r2(this.meses().reduce((s, x) => s + f(x), 0) / this.meses().length) : 0;
  protected promedioCompartidos = computed(() => this.promedio((x) => x.r.compartidos));
  protected promedioLibre = computed(() => this.promedio((x) => x.r.libre));

  /** Por mes: cuánto entró y a dónde fue. Cada barra se lee sola, sin apilar. */
  protected seriesMeses = computed<SerieGrafico[]>(() => [
    { nombre: 'Ingresos', datos: this.meses().map((x) => x.r.ingresos), color: 'var(--p6)' },
    { nombre: 'Gastos compartidos', datos: this.meses().map((x) => x.r.gastos), color: 'var(--p1)' },
    { nombre: 'Ahorro USD', datos: this.meses().map((x) => x.r.usdEnPesos), color: 'var(--p2)' },
    { nombre: 'Tarjetas', datos: this.meses().map((x) => r2(x.r.nico.tarjeta + x.r.nanu.tarjeta)), color: 'var(--p3)' },
    { nombre: 'Libre (los dos)', datos: this.meses().map((x) => Math.max(0, r2(x.r.libre * 2))), color: 'var(--p4)' },
  ]);

  /** Categorías de todos los meses, de la que más se gasta a la que menos. */
  protected categorias = computed(() => {
    const total = new Map<string, number>();
    for (const x of this.meses()) for (const f of x.evv.filas) total.set(f.nombre, (total.get(f.nombre) ?? 0) + f.efectivo);
    return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([nombre]) => nombre);
  });

  /** Por categoría: una barra por mes, para ver cómo cambia cada gasto de un mes al otro. */
  protected seriesCategorias = computed<SerieGrafico[]>(() =>
    this.meses().map((x, i) => ({
      nombre: x.corto,
      datos: this.categorias().map((c) => x.evv.filas.find((f) => f.nombre === c)?.efectivo ?? 0),
      color: `var(--p${(i % 8) + 1})`,
    })),
  );
}
