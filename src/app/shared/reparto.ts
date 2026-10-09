import { Persona } from '../models/config';
import { Item, Moneda, Parte, Resumen } from '../models/resumen';
import { r2, repartoIgual } from './montos';

/** Moneda en la que se reparte un ítem: dólares solo si no tiene pesos. */
export const moneda = (r: Pick<Item, 'pesos' | 'usd'>): Moneda => (r.usd && !r.pesos ? 'usd' : 'pesos');

/** Identifica la misma compra en distintos meses: misma fecha, comprobante y detalle (la cuota cambia). */
export const claveDe = (r: Item): string => (r.tipo === 'impuestos' ? 'impuestos' : `${r.fecha}|${r.comp}|${r.detalle}`);

export function asignado(r: Item): { pesos: number; usd: number } {
  let pesos = 0;
  let usd = 0;
  for (const p of r.partes) {
    if (!p.p) continue;
    pesos += p.pesos || 0;
    usd += p.usd || 0;
  }
  return { pesos: r2(pesos), usd: r2(usd) };
}

/** Lo que falta asignar de un ítem. Si las partes suman de más, no cuenta como pendiente. */
export function falta(r: Item): { pesos: number; usd: number } {
  const a = asignado(r);
  return { pesos: Math.max(0, r2(r.pesos - a.pesos)), usd: Math.max(0, r2(r.usd - a.usd)) };
}

export const pendiente = (r: Item): boolean => {
  const f = falta(r);
  return f.pesos > 0 || f.usd > 0;
};

/** Diferencia entre el ítem y la suma de sus partes, en su moneda (positiva = faltan, negativa = sobran). */
export function diferencia(r: Item): number {
  const m = moneda(r);
  return r2(r[m] - r.partes.reduce((s, p) => s + (p[m] || 0), 0));
}

/** Todo el ítem para una persona (o sin asignar si `persona` está vacío). */
export function asignarA(r: Item, persona: string): Parte[] {
  return persona ? [{ p: persona, pesos: r.pesos, usd: r.usd }] : [];
}

/** Divide el ítem en `n` partes iguales, conservando las personas que ya tenía. */
export function dividir(r: Item, n: number): Parte[] {
  const m = moneda(r);
  const montos = repartoIgual(r[m], n);
  return montos.map((v, i) => ({ p: r.partes[i]?.p ?? '', pesos: 0, usd: 0, [m]: v }));
}

/**
 * Cambia el monto de una parte y reparte lo que resta en partes iguales entre las siguientes
 * (si es la última, entre las anteriores). Si el monto supera el total, las otras quedan en 0.
 */
export function ajustarParte(r: Item, i: number, valor: number): Parte[] {
  const m = moneda(r);
  const partes = r.partes.map((p) => ({ ...p }));
  partes[i][m] = valor;
  const esUltima = i === partes.length - 1;
  const otras = esUltima ? partes.slice(0, i) : partes.slice(i + 1);
  const fijas = esUltima ? [partes[i]] : partes.slice(0, i + 1);
  const resto = Math.max(0, r2(r[m] - fijas.reduce((s, p) => s + (p[m] || 0), 0)));
  repartoIgual(resto, otras.length).forEach((v, k) => (otras[k][m] = v));
  return partes;
}

/** Quita una parte y le pasa su monto a la última que queda, para que siga sumando el total. */
export function quitarParte(r: Item, i: number): Parte[] {
  const partes = r.partes.filter((_, k) => k !== i).map((p) => ({ ...p }));
  if (partes.length === 1) return asignarA(r, partes[0].p);
  if (partes.length > 1) {
    const m = moneda(r);
    const ultima = partes[partes.length - 1];
    ultima[m] = r2(ultima[m] + r2(r[m] - partes.reduce((s, p) => s + (p[m] || 0), 0)));
  }
  return partes;
}

/**
 * Completa los ítems sin asignar copiando el reparto de otros meses (la misma compra en cuotas).
 * `otros` va en orden de prioridad: si una compra aparece en varios, gana el último.
 * Si la cuota cambió de monto, las partes se ajustan en proporción para que sumen justo.
 * Devuelve cuántos ítems se completaron.
 */
export function arrastrar(rows: Item[], otros: Resumen[], tarjetas: Record<string, string> = {}): number {
  const conocidos = new Map<string, { r: Item; mes: string }>();
  for (const res of otros) {
    for (const r of res.rows) if (r.partes.some((p) => p.p)) conocidos.set(claveDe(r), { r, mes: res.meta.cierre });
  }
  let completados = 0;
  for (const r of rows) {
    if (r.partes.length) continue;
    const o = conocidos.get(claveDe(r));
    if (o) {
      const partes = o.r.partes.filter((p) => p.p);
      if (partes.length === 1) r.partes = asignarA(r, partes[0].p);
      else {
        const m = moneda(r);
        const om = moneda(o.r);
        const base = partes.reduce((s, p) => s + (p[om] || 0), 0) || 1;
        r.partes = partes.map((p) => ({ p: p.p, pesos: 0, usd: 0, [m]: r2(((p[om] || 0) * r[m]) / base) }));
        const ultima = r.partes[r.partes.length - 1];
        ultima[m] = r2(ultima[m] + r2(r[m] - r.partes.reduce((s, p) => s + p[m], 0)));
      }
      r.origen = o.mes;
      completados++;
    } else if (tarjetas[r.tarjeta]) {
      r.partes = asignarA(r, tarjetas[r.tarjeta]);
    }
  }
  return completados;
}

export interface TotalPersona {
  pesos: number;
  usd: number;
  items: number;
}

/** Total de cada persona en un resumen, más lo que falta asignar (clave ''). */
export function totalesPorPersona(res: Resumen, personas: Persona[]): Map<string, TotalPersona> {
  const tot = new Map<string, TotalPersona>();
  for (const p of personas) tot.set(p.id, { pesos: 0, usd: 0, items: 0 });
  const sin: TotalPersona = { pesos: 0, usd: 0, items: 0 };
  for (const r of res.rows) {
    for (const p of r.partes) {
      const t = p.p && tot.get(p.p);
      if (!t) continue;
      t.pesos = r2(t.pesos + (p.pesos || 0));
      t.usd = r2(t.usd + (p.usd || 0));
      t.items++;
    }
    const f = falta(r);
    if (f.pesos || f.usd) {
      sin.pesos = r2(sin.pesos + f.pesos);
      sin.usd = r2(sin.usd + f.usd);
      sin.items++;
    }
  }
  tot.set('', sin);
  return tot;
}
