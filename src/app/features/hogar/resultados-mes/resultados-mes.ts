import { Component, computed, inject, input } from '@angular/core';
import { MesHogar, Quien } from '../../../models/hogar';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Hogar } from '../../../services/hogar';
import { Grafico, SerieGrafico } from '../../../shared/componentes/grafico/grafico';
import { GraficoTorta } from '../../../shared/componentes/grafico-torta/grafico-torta';
import { calcularMes, estimadoVsReal, resumenPagos } from '../../../shared/hogar';
import { r2 } from '../../../shared/montos';

/** Resultado del mes: qué falta pagar, cuánto pone cada uno, estimado vs. real por categoría y a dónde va el sueldo. */
@Component({
  selector: 'app-resultados-mes',
  imports: [PesosPipe, Grafico, GraficoTorta],
  templateUrl: './resultados-mes.html',
  styleUrl: './resultados-mes.css',
})
export class ResultadosMes {
  mes = input.required<MesHogar>();

  protected hogar = inject(Hogar);
  protected readonly quienes: Quien[] = ['nico', 'nanu'];
  protected nombres = this.hogar.nombres;

  protected r = computed(() => calcularMes(this.mes()));
  protected evv = computed(() => estimadoVsReal(this.mes()));
  protected pagos = computed(() => resumenPagos(this.mes()));
  protected pasadas = computed(() => this.evv().filas.filter((f) => f.pasado).map((f) => f.nombre));
  /** El total de estimado vs. real solo compara las categorías que tienen estimado. */
  protected diferenciaTotal = computed(() => r2(this.evv().filas.filter((f) => f.estimado > 0).reduce((s, f) => s + f.diferencia, 0)));
  protected hayEstimados = computed(() => this.evv().filas.some((f) => f.estimado > 0));
  /** Todo lo compartido y las tarjetas están pagados. */
  protected todoPagado = computed(() => this.pagos().faltaCompartido === 0 && this.pagos().faltaTarjetas === 0);
  /** ¿Alguna persona tiene gastos compartidos dentro de su tarjeta? */
  protected hayCompartidoEnTarjeta = computed(() => this.quienes.some((q) => this.r()[q].tarjetaCompartida > 0));

  protected etiquetas = computed(() => this.evv().filas.map((f) => f.nombre));
  protected series = computed<SerieGrafico[]>(() => [
    { nombre: 'Estimado', datos: this.evv().filas.map((f) => f.estimado), color: 'var(--p6)' },
    { nombre: 'Real', datos: this.evv().filas.map((f) => f.real), color: 'var(--p1)' },
  ]);

  /** A dónde va el sueldo: gastos compartidos, ahorro en dólares, tarjetas y lo libre de los dos. */
  protected distribucion = computed(() => {
    const r = this.r();
    const tarjetas = r2(r.nico.tarjeta + r.nanu.tarjeta);
    const partes = [
      { nombre: 'Gastos compartidos', monto: r.gastos, color: 'var(--p1)' },
      { nombre: 'Ahorro USD', monto: r.usdEnPesos, color: 'var(--p2)' },
      { nombre: 'Tarjetas', monto: tarjetas, color: 'var(--p3)' },
      { nombre: 'Libre', monto: r2(r.libre * 2), color: 'var(--p4)' },
    ];
    return partes.map((p) => ({ ...p, porcentaje: r.ingresos > 0 ? Math.max(0, (p.monto / r.ingresos) * 100) : 0 }));
  });
  protected tortaEtiquetas = computed(() => this.distribucion().map((p) => p.nombre));
  protected tortaValores = computed(() => this.distribucion().map((p) => p.monto));
  protected tortaColores = computed(() => this.distribucion().map((p) => p.color));
}
