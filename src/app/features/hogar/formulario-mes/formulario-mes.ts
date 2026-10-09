import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GastoCompartido, MesHogar, Pago, Quien } from '../../../models/hogar';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Datos } from '../../../services/datos';
import { Hogar, nuevoId } from '../../../services/hogar';
import { nombreMes } from '../../../shared/fechas';
import { calcularMes, estadoGasto, faltaPagar, ingresoDe, montoGasto, pagoConTarjeta, resumenDelMes, totalExtras, totalesDeTarjeta, variacionGasto } from '../../../shared/hogar';
import { formatoMonto, montoIngresado, r2 } from '../../../shared/montos';
import { Cotizaciones } from '../cotizaciones/cotizaciones';

/** Carga de un mes: sueldos y extras, ahorro en dólares, gastos compartidos (estimado y real), tarjetas y notas. */
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
  protected totalGastos = computed(() => calcularMes(this.mes()).gastos);
  protected estado = estadoGasto;
  protected monto = montoGasto;
  protected falta = faltaPagar;
  protected conTarjeta = pagoConTarjeta;
  protected totalExtras = (q: Quien) => totalExtras(this.mes(), q);
  protected ingreso = (q: Quien) => ingresoDe(this.mes(), q);
  protected formato = formatoMonto;

  /** Quién puede haber pagado un gasto compartido. */
  protected opcionesPago = computed<{ valor: Pago; nombre: string }[]>(() => {
    const n = this.nombres();
    return [
      { valor: 'pozo', nombre: 'Cuenta común' },
      { valor: 'nico', nombre: n.nico },
      { valor: 'nanu', nombre: n.nanu },
      { valor: 'tarjeta-nico', nombre: `Tarjeta de ${n.nico}` },
      { valor: 'tarjeta-nanu', nombre: `Tarjeta de ${n.nanu}` },
    ];
  });

  /** Un cambio de menos de este % contra el mes anterior no se avisa. */
  private readonly UMBRAL_VARIACION = 10;
  protected variacion(g: GastoCompartido): number | null {
    const v = variacionGasto(g, this.anterior());
    return v !== null && Math.abs(v) >= this.UMBRAL_VARIACION ? v : null;
  }
  protected porcentaje = (v: number) => (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%';

  protected avisoTarjeta = signal<{ texto: string; error: boolean } | null>(null);
  /** Gasto recién agregado: se muestra abierto para completarlo. */
  protected nuevo = signal<string | null>(null);

  private cambiar(cambio: (m: MesHogar) => void) {
    this.hogar.actualizar(this.id(), cambio);
  }
  private texto = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  private importe = (e: Event) => montoIngresado(this.texto(e));

  /** Categorías para elegir; si el gasto tiene una que ya no está en la lista, se conserva. */
  protected opciones(g: GastoCompartido): string[] {
    return this.categorias().includes(g.categoria) ? this.categorias() : [...this.categorias(), g.categoria];
  }

  // ---------- Sueldos y extras ----------
  protected sueldo(q: Quien, e: Event) {
    const v = this.importe(e);
    this.cambiar((m) => (m.ingresos[q] = v));
  }
  protected agregarExtra(q: Quien) {
    this.cambiar((m) => m.extras[q].push({ id: nuevoId(), concepto: 'Aguinaldo', monto: 0 }));
  }
  protected extraConcepto(q: Quien, id: string, e: Event) {
    const v = this.texto(e);
    this.cambiar((m) => {
      const x = m.extras[q].find((x) => x.id === id);
      if (x) x.concepto = v;
    });
  }
  protected extraMonto(q: Quien, id: string, e: Event) {
    const v = this.importe(e);
    this.cambiar((m) => {
      const x = m.extras[q].find((x) => x.id === id);
      if (x) x.monto = v;
    });
  }
  protected quitarExtra(q: Quien, id: string) {
    this.cambiar((m) => (m.extras[q] = m.extras[q].filter((x) => x.id !== id)));
  }

  // ---------- Ahorro en dólares ----------
  protected ahorro(campo: 'planificados' | 'cotizacion', e: Event) {
    const v = this.importe(e);
    this.cambiar((m) => (m.usd[campo] = v));
  }
  protected compradosUsd(e: Event) {
    const t = this.texto(e).trim();
    this.cambiar((m) => (m.usd.comprados = t === '' ? null : montoIngresado(t)));
  }
  /** La tilde "ya compré": toma los planificados como comprados; al sacarla vuelven a estar pendientes. */
  protected usdComprados(e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.cambiar((m) => (m.usd.comprados = v ? (m.usd.comprados ?? m.usd.planificados) : null));
  }
  protected cotizacionElegida(v: number) {
    this.cambiar((m) => (m.usd.cotizacion = v));
  }
  protected pagaUsd(e: Event) {
    const v = this.texto(e) as Pago;
    this.cambiar((m) => (m.usd.pagadoPor = v));
  }

  // ---------- Gastos compartidos ----------
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
    const v = this.importe(e);
    this.gasto(id, (g) => (g.estimado = v));
  }
  /**
   * Lo gastado hasta ahora. Si todavía es menos que el estimado, el gasto sigue abierto (falta pagar) hasta que se
   * lo tilde; si ya alcanzó el estimado, o no había estimado, queda pagado. Vaciarlo lo deja pendiente.
   */
  protected real(id: string, e: Event) {
    const t = this.texto(e).trim();
    this.gasto(id, (g) => {
      g.real = t === '' ? null : montoIngresado(t);
      g.pagado = g.real !== null && (g.estimado <= 0 || g.real >= g.estimado);
    });
  }

  /** La tilde: ya se pagó o se compró. Si no había monto cargado, se toma el estimado. */
  protected pagado(id: string, e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.gasto(id, (g) => {
      g.pagado = v;
      if (v && g.real === null) g.real = g.estimado > 0 ? g.estimado : null;
    });
  }
  protected pagadoPor(id: string, e: Event) {
    const v = this.texto(e) as Pago;
    this.gasto(id, (g) => (g.pagadoPor = v));
  }
  // Pagos en partes: el real del gasto es siempre la suma de sus pagos.
  private pago(id: string, pagoId: string, cambio: (p: GastoCompartido['pagos'][number]) => void) {
    this.gasto(id, (g) => {
      const p = g.pagos.find((x) => x.id === pagoId);
      if (p) cambio(p);
      g.real = g.pagos.length ? r2(g.pagos.reduce((s, x) => s + x.monto, 0)) : g.real;
    });
  }
  /** Fecha de hoy si es del mes que se está viendo; si no, el primer día de ese mes. */
  private fechaPorDefecto(): string {
    const hoy = new Date().toISOString().slice(0, 10);
    return hoy.startsWith(this.id()) ? hoy : this.id() + '-01';
  }
  protected agregarPago(id: string) {
    const fecha = this.fechaPorDefecto();
    this.gasto(id, (g) => g.pagos.push({ id: nuevoId(), fecha, monto: 0, pagadoPor: g.pagadoPor }));
  }
  protected pagoFecha(id: string, pagoId: string, e: Event) {
    const v = this.texto(e);
    this.pago(id, pagoId, (p) => (p.fecha = v));
  }
  protected pagoMonto(id: string, pagoId: string, e: Event) {
    const v = this.importe(e);
    this.pago(id, pagoId, (p) => (p.monto = v));
  }
  protected pagoPor(id: string, pagoId: string, e: Event) {
    const v = this.texto(e) as Pago;
    this.pago(id, pagoId, (p) => (p.pagadoPor = v));
  }
  protected quitarPago(id: string, pagoId: string) {
    this.gasto(id, (g) => {
      g.pagos = g.pagos.filter((x) => x.id !== pagoId);
      if (g.pagos.length) g.real = r2(g.pagos.reduce((s, x) => s + x.monto, 0));
      else {
        g.real = null;
        g.pagado = false;
      }
    });
  }

  protected recurrente(id: string, e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.gasto(id, (g) => (g.recurrente = v));
  }
  protected agregar() {
    const id = nuevoId();
    const categoria = this.categorias()[0] ?? 'Otros';
    this.nuevo.set(id);
    this.cambiar((m) =>
      m.gastos.push({ id, concepto: '', categoria, estimado: 0, real: null, pagadoPor: 'pozo', recurrente: true, pagos: [], pagado: false }),
    );
  }
  protected quitar(id: string) {
    this.cambiar((m) => (m.gastos = m.gastos.filter((g) => g.id !== id)));
  }

  // ---------- Tarjetas ----------
  /** Si se corrige a mano el total de una tarjeta, deja de valer el aviso de "tomado de Reparto Visa". */
  protected tarjeta(q: Quien, e: Event) {
    const v = this.importe(e);
    this.avisoTarjeta.set(null);
    this.cambiar((m) => {
      m.tarjetas[q] = v;
      delete m.tarjetasOrigen;
    });
  }

  protected tarjetaPagada(q: Quien, e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.cambiar((m) => (m.tarjetasPagadas[q] = v));
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
