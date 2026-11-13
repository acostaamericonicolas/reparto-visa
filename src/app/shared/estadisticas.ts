import { Persona } from '../models/config';
import { CuotaAVencer, Item, Moneda, Resumen } from '../models/resumen';
import { fechaIso, mesCorto, sumarMeses } from './fechas';
import { r2 } from './montos';
import { claveDe, esRecurrente, falta, leerPlazo } from './reparto';

/** Una línea de datos por persona (id '' = sin asignar). */
export interface Serie {
  id: string;
  nombre: string;
  datos: number[];
}

export interface GastoPorMes {
  etiquetas: string[];
  pesos: Serie[];
  usd: Serie[];
  totalPesos: number[];
  totalUsd: number[];
}

export const SIN_ASIGNAR = 'Sin asignar';

/** "yyyy-mm" del mes en que vence el resumen (así se nombran los meses en la app). */
export const mesDeVencimiento = (r: Resumen): string => (fechaIso(r.meta.vence) ?? r.meta.id).slice(0, 7);

/** Gasto de cada persona en cada resumen, en pesos y en dólares. Los meses van del más viejo al más nuevo. */
export function gastoPorMes(resumenes: Resumen[], personas: Persona[]): GastoPorMes {
  const orden = [...resumenes].sort((a, b) => a.meta.id.localeCompare(b.meta.id));
  const ids = [...personas.map((p) => p.id), ''];
  const pesos = new Map(ids.map((id) => [id, orden.map(() => 0)]));
  const usd = new Map(ids.map((id) => [id, orden.map(() => 0)]));

  orden.forEach((res, m) => {
    for (const r of res.rows) {
      for (const p of r.partes) {
        if (!p.p || !pesos.has(p.p)) continue;
        pesos.get(p.p)![m] = r2(pesos.get(p.p)![m] + (p.pesos || 0));
        usd.get(p.p)![m] = r2(usd.get(p.p)![m] + (p.usd || 0));
      }
      const f = falta(r);
      pesos.get('')![m] = r2(pesos.get('')![m] + f.pesos);
      usd.get('')![m] = r2(usd.get('')![m] + f.usd);
    }
  });

  const series = (mapa: Map<string, number[]>): Serie[] =>
    ids
      .map((id) => ({ id, nombre: id ? (personas.find((p) => p.id === id)?.nombre ?? '') : SIN_ASIGNAR, datos: mapa.get(id)! }))
      .filter((s) => s.datos.some((v) => v !== 0));

  const total = (mapa: Map<string, number[]>) => orden.map((_, m) => r2(ids.reduce((s, id) => s + mapa.get(id)![m], 0)));

  return {
    etiquetas: orden.map((r) => mesCorto(mesDeVencimiento(r) + '-01')),
    pesos: series(pesos),
    usd: series(usd),
    totalPesos: total(pesos),
    totalUsd: total(usd),
  };
}

/** Variación porcentual contra el valor anterior (null si no hay base para comparar). */
export function variacion(actual: number, anterior: number | undefined): number | null {
  if (anterior === undefined || anterior === 0) return null;
  return (actual - anterior) / Math.abs(anterior);
}

export interface Proyeccion {
  etiquetas: string[];
  series: Serie[];
  total: number[];
  /** Lo que informa el banco en "Cuotas a vencer", alineado con `etiquetas` (null si no informa ese mes). */
  banco: (number | null)[];
  /** Último tramo del banco ("A partir de ..."), que no se grafica. */
  bancoDesde?: CuotaAVencer;
  /** Lo que suman por mes los gastos recurrentes (ya incluido en `series` y `total`). */
  recurrentes: number;
}

/** Meses que se proyectan como mínimo cuando hay gastos recurrentes, aunque no queden cuotas. */
export const MESES_RECURRENTES = 3;

/** Una compra en cuotas, con la última cuota cobrada en el resumen. */
interface CompraEnCuotas {
  n: number;
  total: number;
  row: Item;
}

/** Si una compra aparece varias veces en el mes (cuotas adelantadas), manda la de número más alto. */
function comprasEnCuotas(res: Resumen, moneda: Moneda = 'pesos'): CompraEnCuotas[] {
  const porCompra = new Map<string, CompraEnCuotas>();
  for (const r of res.rows) {
    const m = /^(\d+)\/(\d+)$/.exec(r.cuota);
    if (!m || !r[moneda]) continue;
    const [n, total] = [+m[1], +m[2]];
    const previo = porCompra.get(claveDe(r));
    if (!previo || n > previo.n) porCompra.set(claveDe(r), { n, total, row: r });
  }
  return [...porCompra.values()];
}

/** Un gasto recurrente: con plazo ("01/10") le quedan `restantes` meses; sin plazo (null) sigue todos los meses. */
interface Recurrente {
  row: Item;
  restantes: number | null;
}

/** Gastos recurrentes del resumen que se proyectan (los que tienen monto en esa moneda y no terminaron su plazo). */
function recurrentesDe(res: Resumen, moneda: Moneda = 'pesos'): Recurrente[] {
  return res.rows
    .filter((r) => esRecurrente(r) && r[moneda])
    .map((row) => {
      const p = leerPlazo(row.plazo);
      return { row, restantes: p ? p.total - p.n : null };
    })
    .filter((r) => r.restantes !== 0);
}

/**
 * Cuántos resúmenes siguientes se proyectan: hasta la última cuota (o el último mes de un recurrente con plazo),
 * y al menos `MESES_RECURRENTES` si hay recurrentes de todos los meses.
 */
function horizonteDe(res: Resumen, moneda: Moneda): number {
  const compras = comprasEnCuotas(res, moneda);
  const recurrentes = recurrentesDe(res, moneda);
  return Math.max(
    0,
    ...compras.map((c) => c.total - c.n),
    ...recurrentes.map((r) => r.restantes ?? 0),
    recurrentes.some((r) => r.restantes === null) ? MESES_RECURRENTES : 0,
  );
}

export interface CuotaPendiente {
  fecha: string;
  detalle: string;
  /** Cuota cobrada en el resumen ("05/12"); vacía si es un gasto recurrente. */
  cuota: string;
  /** Gasto recurrente. */
  recurrente?: boolean;
  /** Recurrente sin plazo: se repite todos los meses (`restantes` son los meses proyectados). */
  todosLosMeses?: boolean;
  restantes: number;
  /** Lo que le toca a la persona en cada cuota. */
  porMes: number;
  total: number;
}

/**
 * Cuotas que le quedan a una persona ('' = la parte sin asignar), de la que más debe a la que menos.
 * Los gastos recurrentes se cuentan en todos los meses proyectados.
 */
export function cuotasPendientes(res: Resumen, persona: string, moneda: Moneda = 'pesos'): CuotaPendiente[] {
  const compras = comprasEnCuotas(res, moneda);
  const horizonte = horizonteDe(res, moneda);
  const porMesDe = (row: Item) =>
    persona ? r2(row.partes.filter((p) => p.p === persona).reduce((s, p) => s + (p[moneda] || 0), 0)) : falta(row)[moneda];
  const cuotas = compras
    .filter((c) => c.n < c.total)
    .map(({ n, total, row }): CuotaPendiente => {
      const porMes = porMesDe(row);
      const restantes = total - n;
      return { fecha: row.fecha, detalle: row.detalle, cuota: row.cuota, restantes, porMes, total: r2(porMes * restantes) };
    });
  const recurrentes = recurrentesDe(res, moneda).map(({ row, restantes }): CuotaPendiente => {
    const porMes = porMesDe(row);
    const meses = restantes ?? horizonte;
    return {
      fecha: row.fecha,
      detalle: row.detalle,
      cuota: row.plazo ?? '',
      recurrente: true,
      ...(restantes === null ? { todosLosMeses: true } : {}),
      restantes: meses,
      porMes,
      total: r2(porMes * meses),
    };
  });
  return [...cuotas, ...recurrentes].filter((c) => c.porMes > 0).sort((a, b) => b.total - a.total);
}

/**
 * Cuánto le queda pagar a cada persona en los próximos resúmenes, según las cuotas pendientes del resumen dado
 * y sus gastos recurrentes. Una cuota 05/12 suma su monto en los 7 resúmenes siguientes; un recurrente, en todos
 * los proyectados. Pesos y dólares van por separado (`moneda`).
 */
export function proyeccionCuotas(res: Resumen, personas: Persona[], moneda: Moneda = 'pesos'): Proyeccion {
  const compras = comprasEnCuotas(res, moneda);
  const recurrentes = recurrentesDe(res, moneda);
  const horizonte = horizonteDe(res, moneda);
  const ids = [...personas.map((p) => p.id), ''];
  const datos = new Map(ids.map((id) => [id, Array<number>(horizonte).fill(0)]));

  const meses = [
    ...compras.map(({ n, total, row }) => ({ row, cantidad: total - n })),
    ...recurrentes.map(({ row, restantes }) => ({ row, cantidad: restantes ?? horizonte })),
  ];
  for (const { row, cantidad } of meses) {
    const sinDueno = falta(row)[moneda];
    for (let k = 0; k < cantidad; k++) {
      for (const p of row.partes) {
        if (p.p && datos.has(p.p)) datos.get(p.p)![k] = r2(datos.get(p.p)![k] + (p[moneda] || 0));
      }
      if (sinDueno) datos.get('')![k] = r2(datos.get('')![k] + sinDueno);
    }
  }

  const base = mesDeVencimiento(res);
  const etiquetas = Array.from({ length: horizonte }, (_, k) => mesCorto(sumarMeses(base, k + 1) + '-01'));
  const series = ids
    .map((id) => ({ id, nombre: id ? (personas.find((p) => p.id === id)?.nombre ?? '') : SIN_ASIGNAR, datos: datos.get(id)! }))
    .filter((s) => s.datos.some((v) => v !== 0));

  // El banco informa a partir del próximo resumen, en orden: la posición i corresponde al mes i + 1. Solo en pesos.
  const informadas = moneda === 'pesos' ? (res.meta.cuotasAVencer ?? []).filter((c) => !c.mes.startsWith('Desde')) : [];
  const banco = etiquetas.map((_, k) => informadas[k]?.pesos ?? null);

  return {
    etiquetas,
    series,
    total: etiquetas.map((_, k) => r2(ids.reduce((s, id) => s + datos.get(id)![k], 0))),
    banco,
    bancoDesde: moneda === 'pesos' ? res.meta.cuotasAVencer?.find((c) => c.mes.startsWith('Desde')) : undefined,
    recurrentes: r2(recurrentes.reduce((s, r) => s + r.row[moneda], 0)),
  };
}

export interface Estimado {
  /** Cuotas que vencen ese mes, en pesos. */
  cuotas: number;
  /** Gastos recurrentes en pesos. */
  recurrentes: number;
  /** Total en pesos. */
  total: number;
  /** Cuotas y recurrentes en dólares. */
  usd: number;
}

/** Lo que ya se sabe que va a venir en el resumen `k` meses después de `res` (k = 1 es el siguiente). */
export function estimadoMes(res: Resumen, k: number): Estimado {
  const cuotasEn = (m: Moneda) =>
    r2(
      comprasEnCuotas(res, m)
        .filter((c) => c.total - c.n >= k)
        .reduce((s, c) => s + c.row[m], 0),
    );
  const recurrentesEn = (m: Moneda) =>
    r2(
      recurrentesDe(res, m)
        .filter((r) => r.restantes === null || r.restantes >= k)
        .reduce((s, r) => s + r.row[m], 0),
    );
  const cuotas = cuotasEn('pesos');
  const recurrentes = recurrentesEn('pesos');
  return { cuotas, recurrentes, total: r2(cuotas + recurrentes), usd: r2(cuotasEn('usd') + recurrentesEn('usd')) };
}
