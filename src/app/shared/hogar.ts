import { Persona } from '../models/config';
import { CATEGORIA_AHORRO, GastoCompartido, MesHogar, OrigenTarjetas, Pago, Quien } from '../models/hogar';
import { Resumen } from '../models/resumen';
import { fechaIso } from './fechas';
import { r2 } from './montos';
import { totalesPorPersona } from './reparto';

/**
 * Reparto de los gastos del hogar (modelo "libre igual"):
 * sueldos − gastos compartidos − tarjetas, lo que sobra se divide en partes iguales.
 * Cada uno aporta a los gastos compartidos lo que le queda de su sueldo después de su tarjeta y su parte libre.
 */

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Lo que se usa en los cálculos. Un gasto ya pagado vale su real. Mientras no se termina de pagar vale
 * al menos el estimado (si se paga en partes, lo pagado hasta ahora no puede achicar el mes), o lo pagado si ya lo superó.
 */
export const montoGasto = (g: GastoCompartido): number => {
  const real = g.real === null ? null : num(g.real);
  if (g.pagado) return real ?? num(g.estimado);
  return Math.max(num(g.estimado), real ?? 0);
};

/** Lo que falta pagar de un gasto que todavía no se dio por pagado. */
export const faltaPagar = (g: GastoCompartido): number =>
  g.pagado ? 0 : Math.max(0, r2(num(g.estimado) - (g.real === null ? 0 : num(g.real))));

export const usdDelMes = (m: MesHogar): number => (m.usd.comprados === null ? num(m.usd.planificados) : num(m.usd.comprados));

export interface Persona2 {
  /** Sueldo más los extras del mes. */
  ingreso: number;
  sueldo: number;
  extras: number;
  /** Total de la tarjeta, como lo informa el resumen. */
  tarjetaTotal: number;
  /** De ese total, lo que es un gasto compartido (ej. un seguro): se cuenta como compartido, no como personal. */
  tarjetaCompartida: number;
  /** La parte personal de la tarjeta: lo que se descuenta de su plata. */
  tarjeta: number;
  libre: number;
  /** Aporte a los gastos compartidos: ingreso − (tarjeta personal + libre). */
  aporte: number;
  /** Gastos compartidos que pagó de su bolsillo o con su tarjeta. */
  adelantado: number;
  /** Lo que tiene que transferir a la cuenta común (negativo = le corresponde recibir). */
  neto: number;
}

export interface ResultadoMes {
  ingresos: number;
  usdEnPesos: number;
  usd: number;
  gastos: number;
  compartidos: number;
  pozo: number;
  libre: number;
  nico: Persona2;
  nanu: Persona2;
}

/** A quién se le adelantó un gasto (`null` si salió de la cuenta común). */
export const quienAdelanta = (p: Pago): Quien | null => (p === 'pozo' ? null : p.endsWith('nico') ? 'nico' : 'nanu');
/** ¿Se pagó con tarjeta? Entonces ya está dentro del total de esa tarjeta. */
export const pagoConTarjeta = (p: Pago): boolean => p === 'tarjeta-nico' || p === 'tarjeta-nanu';

export const totalExtras = (m: MesHogar, q: Quien): number => r2(m.extras[q].reduce((s, e) => s + num(e.monto), 0));
export const ingresoDe = (m: MesHogar, q: Quien): number => r2(num(m.ingresos[q]) + totalExtras(m, q));

export function calcularMes(m: MesHogar): ResultadoMes {
  const usd = usdDelMes(m);
  const usdEnPesos = r2(usd * num(m.usd.cotizacion));
  const gastos = r2(m.gastos.reduce((s, g) => s + montoGasto(g), 0));
  const compartidos = r2(gastos + usdEnPesos);
  const ingresos = r2(ingresoDe(m, 'nico') + ingresoDe(m, 'nanu'));
  const pozo = r2(ingresos - compartidos);

  const adelantado: Record<Quien, number> = { nico: 0, nanu: 0 };
  const enTarjeta: Record<Quien, number> = { nico: 0, nanu: 0 };
  const cargar = (pago: Pago, monto: number) => {
    const q = quienAdelanta(pago);
    if (!q) return;
    adelantado[q] += monto;
    if (pagoConTarjeta(pago)) enTarjeta[q] += monto;
  };
  for (const g of m.gastos) {
    // Si se pagó en partes, cada parte la adelantó quien la pagó; si no, todo el gasto.
    if (g.pagos.length) for (const p of g.pagos) cargar(p.pagadoPor, num(p.monto));
    else cargar(g.pagadoPor, montoGasto(g));
  }
  cargar(m.usd.pagadoPor, usdEnPesos);

  // Lo compartido que va en la tarjeta ya está en los gastos compartidos: de la tarjeta solo cuenta el resto.
  const personal = (q: Quien) => Math.max(0, r2(num(m.tarjetas[q]) - enTarjeta[q]));
  const libre = r2((pozo - personal('nico') - personal('nanu')) / 2);

  const persona = (q: Quien): Persona2 => {
    const tarjeta = personal(q);
    const aporte = r2(ingresoDe(m, q) - (libre + tarjeta));
    return {
      ingreso: ingresoDe(m, q),
      sueldo: num(m.ingresos[q]),
      extras: totalExtras(m, q),
      tarjetaTotal: num(m.tarjetas[q]),
      tarjetaCompartida: r2(enTarjeta[q]),
      tarjeta,
      libre,
      aporte,
      adelantado: r2(adelantado[q]),
      neto: r2(aporte - adelantado[q]),
    };
  };
  return { ingresos, usdEnPesos, usd, gastos, compartidos, pozo, libre, nico: persona('nico'), nanu: persona('nanu') };
}

export interface Disponible {
  /** Lo libre de la persona en el mes, después de gastos compartidos y tarjeta. */
  libre: number;
  gastado: number;
  /** Lo que le queda: libre − gastos individuales. Negativo = se pasó. */
  queda: number;
  porCategoria: { categoria: string; monto: number }[];
}

/** Cuánto le queda a una persona de su plata libre después de registrar sus gastos individuales. */
export function disponiblePersona(m: MesHogar, q: Quien): Disponible {
  const libre = calcularMes(m).libre;
  const lista = m.individuales[q];
  const gastado = r2(lista.reduce((s, g) => s + num(g.monto), 0));
  const porCat = new Map<string, number>();
  for (const g of lista) porCat.set(g.categoria || 'Otros', (porCat.get(g.categoria || 'Otros') ?? 0) + num(g.monto));
  const porCategoria = [...porCat.entries()].map(([categoria, monto]) => ({ categoria, monto: r2(monto) })).sort((a, b) => b.monto - a.monto);
  return { libre, gastado, queda: r2(libre - gastado), porCategoria };
}

export interface FilaCategoria {
  nombre: string;
  estimado: number;
  real: number;
  /** Lo que cuenta en los cálculos (real, o estimado si todavía no se cargó). */
  efectivo: number;
  diferencia: number;
  /** Se pasó de lo estimado. El ahorro nunca se marca: ahorrar de más no es un problema. */
  pasado: boolean;
  ahorro: boolean;
}

export interface EstimadoVsReal {
  filas: FilaCategoria[];
  estimado: number;
  real: number;
  /** Gastos con algo todavía por pagar. */
  pendientes: number;
}

export function estimadoVsReal(m: MesHogar): EstimadoVsReal {
  const porCategoria = new Map<string, FilaCategoria>();
  const sumar = (nombre: string, estimado: number, real: number, efectivo: number, ahorro: boolean) => {
    const f = porCategoria.get(nombre) ?? { nombre, estimado: 0, real: 0, efectivo: 0, diferencia: 0, pasado: false, ahorro };
    f.estimado += estimado;
    f.real += real;
    f.efectivo += efectivo;
    porCategoria.set(nombre, f);
  };
  let pendientes = 0;
  for (const g of m.gastos) {
    if (faltaPagar(g) > 0) pendientes++;
    sumar(g.categoria || 'Otros', num(g.estimado), g.real === null ? 0 : num(g.real), montoGasto(g), false);
  }
  const cot = num(m.usd.cotizacion);
  sumar(CATEGORIA_AHORRO, num(m.usd.planificados) * cot, m.usd.comprados === null ? 0 : num(m.usd.comprados) * cot, usdDelMes(m) * cot, true);

  const filas = [...porCategoria.values()]
    .filter((f) => f.estimado || f.real || f.efectivo)
    .map((f) => {
      const estimado = r2(f.estimado);
      const real = r2(f.real);
      return { ...f, estimado, real, efectivo: r2(f.efectivo), diferencia: r2(real - estimado), pasado: !f.ahorro && estimado > 0 && real > estimado };
    });
  return { filas, estimado: r2(filas.reduce((s, f) => s + f.estimado, 0)), real: r2(filas.reduce((s, f) => s + f.real, 0)), pendientes };
}

/**
 * Cuánto se pasó (o quedó por debajo) un gasto de lo estimado. Mientras se está pagando en partes solo importa
 * si ya se pasó: quedar por debajo todavía no es un ahorro, es que falta pagar.
 */
export function estadoGasto(g: GastoCompartido): { pasado: boolean; diferencia: number } {
  if (g.real === null || num(g.estimado) <= 0) return { pasado: false, diferencia: 0 };
  const diferencia = r2(g.real - g.estimado);
  return { pasado: diferencia > 0, diferencia: g.pagado ? diferencia : Math.max(0, diferencia) };
}

/** Cuánto subió o bajó un gasto (en %) respecto del mes anterior, buscándolo por concepto. `null` si no se puede comparar. */
export function variacionGasto(g: GastoCompartido, anterior: MesHogar | undefined): number | null {
  if (!anterior || g.real === null || !g.pagado) return null;
  const clave = (x: GastoCompartido) => x.concepto.trim().toLowerCase();
  if (!clave(g)) return null;
  const previo = anterior.gastos.find((x) => clave(x) === clave(g));
  const antes = previo ? montoGasto(previo) : 0;
  return antes > 0 ? Math.round(((g.real - antes) / antes) * 1000) / 10 : null;
}

// ---------- Qué falta pagar ----------

export interface ResumenPagos {
  /** Gastos compartidos con algo por pagar. */
  gastos: { id: string; concepto: string; falta: number }[];
  faltaGastos: number;
  /** Dólares planificados que todavía no se compraron. */
  usd: { falta: number; faltaPesos: number };
  /** Lo compartido que falta: gastos + dólares. */
  faltaCompartido: number;
  /** Lo compartido que ya se pagó (incluye los dólares ya comprados). */
  pagadoCompartido: number;
  /** El resumen de la tarjeta de cada uno y si ya se pagó. */
  tarjetas: Record<Quien, { monto: number; pagada: boolean }>;
  faltaTarjetas: number;
}

export function resumenPagos(m: MesHogar): ResumenPagos {
  const cot = num(m.usd.cotizacion);
  const gastos = m.gastos
    .map((g) => ({ id: g.id, concepto: g.concepto || 'Sin nombre', falta: faltaPagar(g) }))
    .filter((g) => g.falta > 0);
  const faltaGastos = r2(gastos.reduce((s, g) => s + g.falta, 0));
  const usdFalta = m.usd.comprados === null ? num(m.usd.planificados) : 0;
  const usdFaltaPesos = r2(usdFalta * cot);
  const pagadoGastos = m.gastos.reduce((s, g) => s + (g.pagado ? montoGasto(g) : g.real === null ? 0 : num(g.real)), 0);
  const pagadoUsd = m.usd.comprados === null ? 0 : num(m.usd.comprados) * cot;
  const tarjeta = (q: Quien) => ({ monto: num(m.tarjetas[q]), pagada: m.tarjetasPagadas[q] });
  const tarjetas = { nico: tarjeta('nico'), nanu: tarjeta('nanu') };
  return {
    gastos,
    faltaGastos,
    usd: { falta: usdFalta, faltaPesos: usdFaltaPesos },
    faltaCompartido: r2(faltaGastos + usdFaltaPesos),
    pagadoCompartido: r2(pagadoGastos + pagadoUsd),
    tarjetas,
    faltaTarjetas: r2(Object.values(tarjetas).reduce((s, t) => s + (t.pagada ? 0 : t.monto), 0)),
  };
}

// ---------- Tarjeta: totales desde Reparto Visa ----------

/** Mes ("yyyy-mm") en que vence un resumen: es el mes del hogar al que corresponde. */
export const mesDeVencimiento = (r: Resumen): string | null => fechaIso(r.meta.vence)?.slice(0, 7) ?? null;

/** El resumen que corresponde a un mes del hogar es el que vence en ese mes (si hay varios, el más reciente). */
export function resumenDelMes(resumenes: Record<string, Resumen>, mes: string): Resumen | null {
  const candidatos = Object.values(resumenes).filter((r) => mesDeVencimiento(r) === mes);
  return candidatos.sort((a, b) => b.meta.id.localeCompare(a.meta.id))[0] ?? null;
}

export interface TotalesTarjeta {
  tarjetas: Record<Quien, number>;
  origen: OrigenTarjetas;
}

/**
 * Parte de cada uno en un resumen. Lo de otras personas y lo que todavía no tiene dueño no se suma:
 * se informa en `origen` para que se vea qué quedó afuera.
 */
export function totalesDeTarjeta(res: Resumen, personas: Record<Quien, Persona>): TotalesTarjeta {
  const tot = totalesPorPersona(res, [personas.nico, personas.nanu]);
  const nico = tot.get(personas.nico.id)!;
  const nanu = tot.get(personas.nanu.id)!;
  const sin = tot.get('')!;
  const total = r2(res.rows.reduce((s, r) => s + r.pesos, 0));
  return {
    tarjetas: { nico: nico.pesos, nanu: nanu.pesos },
    origen: {
      cierre: res.meta.cierre,
      vence: res.meta.vence,
      total,
      otros: Math.max(0, r2(total - nico.pesos - nanu.pesos - sin.pesos)),
      sinAsignar: sin.pesos,
      usd: { nico: nico.usd, nanu: nanu.usd },
    },
  };
}

// ---------- Meses ----------

/** "2026-10" → mes anterior más cercano que exista, para heredar sus gastos. */
export function mesAnterior(meses: string[], mes: string): string | undefined {
  return meses.filter((m) => m < mes).sort().at(-1);
}

/** Mes nuevo a partir del anterior: lo gastado pasa a ser el estimado y el real queda pendiente. */
export function mesNuevo(anterior: MesHogar | undefined, nuevoId: () => string): MesHogar {
  if (!anterior) {
    return {
      ingresos: { nico: 0, nanu: 0 },
      extras: { nico: [], nanu: [] },
      usd: { planificados: 0, comprados: null, cotizacion: 0, pagadoPor: 'pozo' },
      gastos: [],
      tarjetas: { nico: 0, nanu: 0 },
      tarjetasPagadas: { nico: false, nanu: false },
      individuales: { nico: [], nanu: [] },
      notas: '',
    };
  }
  return {
    ingresos: { ...anterior.ingresos },
    // El aguinaldo, un bono o un gasto propio son de un mes: no pasan al siguiente.
    extras: { nico: [], nanu: [] },
    usd: {
      ...anterior.usd,
      planificados: anterior.usd.comprados ?? anterior.usd.planificados,
      comprados: null,
    },
    // Solo pasan los gastos que se repiten todos los meses; los de una sola vez se quedan en su mes.
    gastos: anterior.gastos
      .filter((g) => g.recurrente)
      .map((g) => ({ ...g, id: nuevoId(), estimado: g.real ?? g.estimado, real: null, pagos: [], pagado: false })),
    tarjetas: { nico: 0, nanu: 0 },
    tarjetasPagadas: { nico: false, nanu: false },
    individuales: { nico: [], nanu: [] },
    notas: '',
  };
}
