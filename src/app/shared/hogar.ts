import { Persona } from '../models/config';
import { CATEGORIA_AHORRO, GastoCompartido, MesHogar, OrigenTarjetas, Quien } from '../models/hogar';
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

/** Lo que se usa en los cálculos: el real si ya se cargó, si no el estimado. */
export const montoGasto = (g: GastoCompartido): number => (g.real === null ? num(g.estimado) : num(g.real));

export const usdDelMes = (m: MesHogar): number => (m.usd.comprados === null ? num(m.usd.planificados) : num(m.usd.comprados));

export interface Persona2 {
  ingreso: number;
  tarjeta: number;
  libre: number;
  /** Aporte a los gastos compartidos: sueldo − (tarjeta + libre). */
  aporte: number;
  /** Gastos compartidos que pagó de su bolsillo. */
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

export function calcularMes(m: MesHogar): ResultadoMes {
  const usd = usdDelMes(m);
  const usdEnPesos = r2(usd * num(m.usd.cotizacion));
  const gastos = r2(m.gastos.reduce((s, g) => s + montoGasto(g), 0));
  const compartidos = r2(gastos + usdEnPesos);
  const ingresos = r2(num(m.ingresos.nico) + num(m.ingresos.nanu));
  const pozo = r2(ingresos - compartidos);
  const libre = r2((pozo - num(m.tarjetas.nico) - num(m.tarjetas.nanu)) / 2);

  const adelantado: Record<Quien, number> = { nico: 0, nanu: 0 };
  for (const g of m.gastos) if (g.pagadoPor !== 'pozo') adelantado[g.pagadoPor] += montoGasto(g);
  if (m.usd.pagadoPor !== 'pozo') adelantado[m.usd.pagadoPor] += usdEnPesos;

  const persona = (q: Quien): Persona2 => {
    const tarjeta = num(m.tarjetas[q]);
    const aporte = r2(num(m.ingresos[q]) - (libre + tarjeta));
    return { ingreso: num(m.ingresos[q]), tarjeta, libre, aporte, adelantado: r2(adelantado[q]), neto: r2(aporte - adelantado[q]) };
  };
  return { ingresos, usdEnPesos, usd, gastos, compartidos, pozo, libre, nico: persona('nico'), nanu: persona('nanu') };
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
  /** Gastos con estimado y sin real cargado. */
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
    if (g.real === null && num(g.estimado) > 0) pendientes++;
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

/** Cuánto se pasó (o quedó por debajo) un gasto de lo estimado. Sin estimado o sin real, no hay diferencia. */
export function estadoGasto(g: GastoCompartido): { pasado: boolean; diferencia: number } {
  if (g.real === null || num(g.estimado) <= 0) return { pasado: false, diferencia: 0 };
  const diferencia = r2(g.real - g.estimado);
  return { pasado: diferencia > 0, diferencia };
}

/** Cuánto subió o bajó un gasto (en %) respecto del mes anterior, buscándolo por concepto. `null` si no se puede comparar. */
export function variacionGasto(g: GastoCompartido, anterior: MesHogar | undefined): number | null {
  if (!anterior || g.real === null) return null;
  const clave = (x: GastoCompartido) => x.concepto.trim().toLowerCase();
  if (!clave(g)) return null;
  const previo = anterior.gastos.find((x) => clave(x) === clave(g));
  const antes = previo ? montoGasto(previo) : 0;
  return antes > 0 ? Math.round(((g.real - antes) / antes) * 1000) / 10 : null;
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
      usd: { planificados: 0, comprados: null, cotizacion: 0, pagadoPor: 'pozo' },
      gastos: [],
      tarjetas: { nico: 0, nanu: 0 },
      notas: '',
    };
  }
  return {
    ingresos: { ...anterior.ingresos },
    usd: {
      ...anterior.usd,
      planificados: anterior.usd.comprados ?? anterior.usd.planificados,
      comprados: null,
    },
    // Solo pasan los gastos que se repiten todos los meses; los de una sola vez se quedan en su mes.
    gastos: anterior.gastos
      .filter((g) => g.recurrente)
      .map((g) => ({ ...g, id: nuevoId(), estimado: g.real ?? g.estimado, real: null })),
    tarjetas: { nico: 0, nanu: 0 },
    notas: '',
  };
}
