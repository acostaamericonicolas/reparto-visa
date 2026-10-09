import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GastoCompartido, MesHogar, Pago, Quien } from '../../../models/hogar';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Datos } from '../../../services/datos';
import { Hogar, nuevoId } from '../../../services/hogar';
import { nombreMes } from '../../../shared/fechas';
import { calcularMes, estadoGasto, resumenDelMes, totalesDeTarjeta, variacionGasto } from '../../../shared/hogar';
import { formatoMonto, montoIngresado } from '../../../shared/montos';
import { Cotizaciones } from '../cotizaciones/cotizaciones';

/** Carga de un mes: sueldos, ahorro en dólares, gastos compartidos (estimado y real), tarjetas y notas. */
@Component({
  selector: 'app-formulario-mes',
  imports: [PesosPipe, RouterLink, Cotizaciones],
  templateUrl: './formulario-mes.html',
  styleUrl: './formulario-mes.css',
})
export class FormularioMes {
  /** Mes en formato "2026-10". */
  id = input.required<string>();
  mes = input.required<MesHogar>();
  /** Mes anterior, para avisar cuánto subió o bajó cada gasto. */
  anterior = input<MesHogar>();
  nombreAnterior = input('');

  protected hogar = inject(Hogar);
  protected datos = inject(Datos);

  protected readonly quienes: Quien[] = ['nico', 'nanu'];
  protected nombres = this.hogar.nombres;
  protected categorias = computed(() => this.hogar.config().categorias);
  protected usdEnPesos = computed(() => calcularMes(this.mes()).usdEnPesos);
  protected estado = estadoGasto;
  /** Un cambio de menos de este % contra el mes anterior no se avisa. */
  private readonly UMBRAL_VARIACION = 10;
  protected variacion(g: GastoCompartido): number | null {
    const v = variacionGasto(g, this.anterior());
    return v !== null && Math.abs(v) >= this.UMBRAL_VARIACION ? v : null;
  }
  protected porcentaje = (v: number) => (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%';
  protected formato = formatoMonto;

  protected avisoTarjeta = signal<{ texto: string; error: boolean } | null>(null);

  private cambiar(cambio: (m: MesHogar) => void) {
    this.hogar.actualizar(this.id(), cambio);
  }
  private texto = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  private monto = (e: Event) => montoIngresado(this.texto(e));

  /** Categorías para elegir; si el gasto tiene una que ya no está en la lista, se conserva. */
  protected opciones(g: GastoCompartido): string[] {
    return this.categorias().includes(g.categoria) ? this.categorias() : [...this.categorias(), g.categoria];
  }

  protected sueldo(q: Quien, e: Event) {
    const v = this.monto(e);
    this.cambiar((m) => (m.ingresos[q] = v));
  }

  protected ahorro(campo: 'planificados' | 'cotizacion', e: Event) {
    const v = this.monto(e);
    this.cambiar((m) => (m.usd[campo] = v));
  }
  protected compradosUsd(e: Event) {
    const t = this.texto(e).trim();
    this.cambiar((m) => (m.usd.comprados = t === '' ? null : montoIngresado(t)));
  }
  protected cotizacionElegida(v: number) {
    this.cambiar((m) => (m.usd.cotizacion = v));
  }
  protected pagaUsd(e: Event) {
    const v = this.texto(e) as Pago;
    this.cambiar((m) => (m.usd.pagadoPor = v));
  }

  private gasto(id: string, cambio: (g: GastoCompartido) => void) {
    this.cambiar((m) => {
      const g = m.gastos.find((x) => x.id === id);
      if (g) cambio(g);
    });
  }
  protected concepto(id: string, e: Event) {
    const v = this.texto(e);
    this.gasto(id, (g) => (g.concepto = v));
  }
  protected categoria(id: string, e: Event) {
    const v = this.texto(e);
    this.gasto(id, (g) => (g.categoria = v));
  }
  protected estimado(id: string, e: Event) {
    const v = this.monto(e);
    this.gasto(id, (g) => (g.estimado = v));
  }
  protected real(id: string, e: Event) {
    const t = this.texto(e).trim();
    this.gasto(id, (g) => (g.real = t === '' ? null : montoIngresado(t)));
  }
  protected pagadoPor(id: string, e: Event) {
    const v = this.texto(e) as Pago;
    this.gasto(id, (g) => (g.pagadoPor = v));
  }
  protected recurrente(id: string, e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.gasto(id, (g) => (g.recurrente = v));
  }
  protected agregar() {
    const categoria = this.categorias()[0] ?? 'Otros';
    this.cambiar((m) =>
      m.gastos.push({ id: nuevoId(), concepto: '', categoria, estimado: 0, real: null, pagadoPor: 'pozo', recurrente: true }),
    );
  }
  protected quitar(id: string) {
    this.cambiar((m) => (m.gastos = m.gastos.filter((g) => g.id !== id)));
  }

  /** Si se corrige a mano el total de una tarjeta, deja de valer el aviso de "tomado de Reparto Visa". */
  protected tarjeta(q: Quien, e: Event) {
    const v = this.monto(e);
    this.avisoTarjeta.set(null);
    this.cambiar((m) => {
      m.tarjetas[q] = v;
      delete m.tarjetasOrigen;
    });
  }

  /** El resumen que vence en este mes, repartido: solo se toma la parte de cada uno. */
  protected traerDeLaTarjeta() {
    const personas = this.hogar.personas();
    if (!personas) {
      this.avisoTarjeta.set({ texto: 'Elegí quién es cada uno en Ajustes → Personas.', error: true });
      return;
    }
    const resumen = resumenDelMes(this.datos.resumenes(), this.id());
    if (!resumen) {
      this.avisoTarjeta.set({ texto: `No hay ningún resumen que venza en ${nombreMes(this.id() + '-01')}. Importalo en Resumen y volvé a probar.`, error: true });
      return;
    }
    const t = totalesDeTarjeta(resumen, personas);
    this.avisoTarjeta.set(null);
    this.cambiar((m) => {
      m.tarjetas = t.tarjetas;
      m.tarjetasOrigen = t.origen;
    });
  }

  protected notas(e: Event) {
    const v = this.texto(e);
    this.cambiar((m) => (m.notas = v));
  }
}
