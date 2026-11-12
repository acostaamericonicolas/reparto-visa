import { Persona } from '../models/config';
import { EstadoPersona, Item, Moneda, Parte, Resumen } from '../models/resumen';
import { r2, repartoIgual } from './montos';

/** Moneda en la que se reparte un ítem: dólares solo si no tiene pesos. */
export const moneda = (r: Pick<Item, 'pesos' | 'usd'>): Moneda => (r.usd && !r.pesos ? 'usd' : 'pesos');

/** Identifica la misma compra en distintos meses: misma fecha, comprobante y detalle (la cuota cambia). */
export const claveDe = (r: Item): string => (r.tipo === 'impuestos' ? 'impuestos' : `${r.fecha}|${r.comp}|${r.detalle}`);

/** Solo un gasto sin cuotas (y que no es el ítem de impuestos) se puede marcar como recurrente. */
export const puedeSerRecurrente = (r: Item): boolean => !r.cuota && r.tipo !== 'impuestos';

export const esRecurrente = (r: Item): boolean => !!r.recurrente && puedeSerRecurrente(r);

/**
 * Identifica el mismo gasto recurrente en distintos meses: misma tarjeta y mismo detalle, sin contar números
 * (la fecha y el comprobante cambian todos los meses, y algunos comercios agregan un número de referencia).
 */
export const claveRecurrente = (r: Item): string =>
  `${r.tarjeta}|${r.detalle.toUpperCase().replace(/\d+/g, '').replace(/\s+/g, ' ').trim()}`;

/** "1/10" → { n: 1, total: 10 }. Null si no es un plazo válido (n entre 1 y el total). */
export function leerPlazo(texto: string | undefined): { n: number; total: number } | null {
  const m = /^\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/.exec(texto ?? '');
  if (!m) return null;
  const [n, total] = [+m[1], +m[2]];
  return n >= 1 && n <= total ? { n, total } : null;
}

/** Plazo con el formato del resumen: (1, 10) → "01/10". */
export const formatoPlazo = (n: number, total: number): string => `${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')}`;

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

/** Si un ítem entra en el filtro de Movimientos: 'todos', '' (sin asignar) o el id de una persona. */
export const visibleEn = (r: Item, filtro: string): boolean =>
  filtro === 'todos' || (filtro === '' ? pendiente(r) : r.partes.some((p) => p.p === filtro));

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

/** Copia el reparto de `o` a `r`. Si cambió el monto, las partes se ajustan en proporción para que sumen justo. */
function copiarReparto(r: Item, o: Item) {
  const partes = o.partes.filter((p) => p.p);
  if (partes.length === 1) {
    r.partes = asignarA(r, partes[0].p);
    return;
  }
  const m = moneda(r);
  const om = moneda(o);
  const base = partes.reduce((s, p) => s + (p[om] || 0), 0) || 1;
  r.partes = partes.map((p) => ({ p: p.p, pesos: 0, usd: 0, [m]: r2(((p[om] || 0) * r[m]) / base) }));
  const ultima = r.partes[r.partes.length - 1];
  ultima[m] = r2(ultima[m] + r2(r[m] - r.partes.reduce((s, p) => s + p[m], 0)));
}

/**
 * Completa los ítems sin asignar copiando el reparto de otros meses: la misma compra en cuotas o, si no,
 * el mismo gasto recurrente (que además queda marcado como recurrente).
 * `otros` va en orden de prioridad: si una compra aparece en varios, gana el último.
 * Si la cuota cambió de monto, las partes se ajustan en proporción para que sumen justo.
 * Devuelve cuántos ítems se completaron.
 */
export function arrastrar(rows: Item[], otros: Resumen[], tarjetas: Record<string, string> = {}): number {
  const conocidos = new Map<string, { r: Item; mes: string }>();
  /** Última aparición de cada gasto sin cuotas: si ahí estaba marcado como recurrente, sigue siéndolo. */
  const ultimos = new Map<string, { r: Item; mes: string }>();
  for (const res of otros) {
    for (const r of res.rows) {
      if (r.partes.some((p) => p.p)) conocidos.set(claveDe(r), { r, mes: res.meta.cierre });
      if (puedeSerRecurrente(r)) ultimos.set(claveRecurrente(r), { r, mes: res.meta.cierre });
    }
  }
  let completados = 0;
  for (const r of rows) {
    const recurrente = puedeSerRecurrente(r) ? ultimos.get(claveRecurrente(r)) : undefined;
    // Si se desmarcó a mano en este mes (false), no se vuelve a marcar ni se le copia el reparto.
    // Con plazo: después del último mes ("10/10") ya no sigue.
    const plazoAnterior = recurrente && leerPlazo(recurrente.r.plazo);
    const mismo = !!recurrente && claveDe(recurrente.r) === claveDe(r);
    const sigueRecurrente =
      !!recurrente &&
      esRecurrente(recurrente.r) &&
      r.recurrente !== false &&
      (!plazoAnterior || mismo || plazoAnterior.n < plazoAnterior.total);
    if (sigueRecurrente) {
      r.recurrente = true;
      // El mismo cobro (al volver a importar ese mes) conserva su plazo; el del mes siguiente avanza uno.
      if (plazoAnterior && !r.plazo) r.plazo = mismo ? recurrente!.r.plazo : formatoPlazo(plazoAnterior.n + 1, plazoAnterior.total);
    }
    if (r.partes.length) continue;
    const o = conocidos.get(claveDe(r)) ?? (sigueRecurrente && recurrente!.r.partes.some((p) => p.p) ? recurrente : undefined);
    if (o) {
      copiarReparto(r, o.r);
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

/**
 * Orden de las tarjetas de personas: primero las que deben, de mayor a menor (pesos y, si empatan, dólares);
 * después las que ya pagaron, con el mismo orden; al final las que no tienen ítems ese mes.
 */
export function ordenarPersonas(
  personas: Persona[],
  totales: Map<string, TotalPersona>,
  estados: Record<string, EstadoPersona> = {},
): Persona[] {
  const grupo = (p: Persona) => (!totales.get(p.id)?.items ? 2 : estados[p.id]?.pagado ? 1 : 0);
  const t = (p: Persona) => totales.get(p.id) ?? { pesos: 0, usd: 0, items: 0 };
  return [...personas].sort((a, b) => grupo(a) - grupo(b) || t(b).pesos - t(a).pesos || t(b).usd - t(a).usd);
}
