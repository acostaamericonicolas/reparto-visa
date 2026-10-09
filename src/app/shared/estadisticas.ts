import { Persona } from '../models/config';
import { CuotaAVencer, Resumen } from '../models/resumen';
import { fechaIso, mesCorto, sumarMeses } from './fechas';
import { r2 } from './montos';
import { claveDe, falta } from './reparto';

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
}

/**
 * Cuánto le queda pagar a cada persona en los próximos resúmenes, según las cuotas pendientes del resumen dado.
 * Una cuota 05/12 suma su monto en los 7 resúmenes siguientes. Solo cuenta pesos.
 */
/** Una compra en cuotas, con la última cuota cobrada en el resumen. */
interface CompraEnCuotas {
  n: number;
  total: number;
  row: Resumen['rows'][number];
}

/** Si una compra aparece varias veces en el mes (cuotas adelantadas), manda la de número más alto. */
function comprasEnCuotas(res: Resumen): CompraEnCuotas[] {
  const porCompra = new Map<string, CompraEnCuotas>();
  for (const r of res.rows) {
    const m = /^(\d+)\/(\d+)$/.exec(r.cuota);
    if (!m || !r.pesos) continue;
    const [n, total] = [+m[1], +m[2]];
    const previo = porCompra.get(claveDe(r));
    if (!previo || n > previo.n) porCompra.set(claveDe(r), { n, total, row: r });
  }
  return [...porCompra.values()];
}

export interface CuotaPendiente {
  fecha: string;
  detalle: string;
  /** Cuota cobrada en el resumen ("05/12"). */
  cuota: string;
  restantes: number;
  /** Lo que le toca a la persona en cada cuota. */
  porMes: number;
  total: number;
}

/** Cuotas que le quedan a una persona ('' = la parte sin asignar), de la que más debe a la que menos. */
export function cuotasPendientes(res: Resumen, persona: string): CuotaPendiente[] {
  return comprasEnCuotas(res)
    .filter((c) => c.n < c.total)
    .map(({ n, total, row }) => {
      const porMes = persona
        ? r2(row.partes.filter((p) => p.p === persona).reduce((s, p) => s + (p.pesos || 0), 0))
        : falta(row).pesos;
      const restantes = total - n;
      return { fecha: row.fecha, detalle: row.detalle, cuota: row.cuota, restantes, porMes, total: r2(porMes * restantes) };
    })
    .filter((c) => c.porMes > 0)
    .sort((a, b) => b.total - a.total);
}

export function proyeccionCuotas(res: Resumen, personas: Persona[]): Proyeccion {
  const porCompra = new Map(comprasEnCuotas(res).map((c) => [claveDe(c.row), c]));

  const horizonte = Math.max(0, ...[...porCompra.values()].map((c) => c.total - c.n));
  const ids = [...personas.map((p) => p.id), ''];
  const datos = new Map(ids.map((id) => [id, Array<number>(horizonte).fill(0)]));

  for (const { n, total, row } of porCompra.values()) {
    const sinDueno = falta(row).pesos;
    for (let k = 0; k < total - n; k++) {
      for (const p of row.partes) {
        if (p.p && datos.has(p.p)) datos.get(p.p)![k] = r2(datos.get(p.p)![k] + (p.pesos || 0));
      }
      if (sinDueno) datos.get('')![k] = r2(datos.get('')![k] + sinDueno);
    }
  }

  const base = mesDeVencimiento(res);
  const etiquetas = Array.from({ length: horizonte }, (_, k) => mesCorto(sumarMeses(base, k + 1) + '-01'));
  const series = ids
    .map((id) => ({ id, nombre: id ? (personas.find((p) => p.id === id)?.nombre ?? '') : SIN_ASIGNAR, datos: datos.get(id)! }))
    .filter((s) => s.datos.some((v) => v !== 0));

  // El banco informa a partir del próximo resumen, en orden: la posición i corresponde al mes i + 1.
  const informadas = (res.meta.cuotasAVencer ?? []).filter((c) => !c.mes.startsWith('Desde'));
  const banco = etiquetas.map((_, k) => informadas[k]?.pesos ?? null);

  return {
    etiquetas,
    series,
    total: etiquetas.map((_, k) => r2(ids.reduce((s, id) => s + datos.get(id)![k], 0))),
    banco,
    bancoDesde: res.meta.cuotasAVencer?.find((c) => c.mes.startsWith('Desde')),
  };
}
