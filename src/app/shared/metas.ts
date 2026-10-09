import { ConfigHogar, MesHogar, MetaAhorro } from '../models/hogar';
import { r2 } from './montos';

export interface ProgresoMeta {
  meta: MetaAhorro;
  /** Dólares de lo ahorrado que le tocan a esta meta (las metas se llenan en orden). */
  ahorrado: number;
  falta: number;
  /** 0–100. Sin objetivo definido, 0. */
  porcentaje: number;
  completa: boolean;
  /** Meses que faltan hasta la fecha elegida (0 = ya pasó). `null` si no hay fecha. */
  mesesRestantes: number | null;
  /** Dólares por mes necesarios para llegar a la fecha, contando lo que falta de las metas anteriores. */
  necesarioPorMes: number | null;
  /** Meses que faltan al ritmo actual. `null` si todavía no hay ritmo. */
  mesesAlRitmo: number | null;
}

export interface ResumenAhorro {
  /** Todo lo ahorrado en dólares: lo inicial más lo comprado en los meses cargados. */
  total: number;
  /** Promedio mensual de dólares comprados en los últimos 3 meses con compras. */
  promedioMensual: number;
  metas: ProgresoMeta[];
  /** Dólares que sobran después de completar todas las metas. */
  excedente: number;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const indiceMes = (m: string): number => +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1);

/**
 * Cuánto se lleva ahorrado y cómo va cada meta. Solo cuentan los dólares efectivamente comprados
 * (los planificados todavía no son ahorro). `hoy` es "yyyy-mm".
 */
export function progresoAhorro(config: Pick<ConfigHogar, 'metas' | 'ahorroInicialUsd'>, meses: Record<string, MesHogar>, hoy: string): ResumenAhorro {
  const compras = Object.entries(meses)
    .filter(([, m]) => m.usd.comprados !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => num(m.usd.comprados));
  const total = r2(num(config.ahorroInicialUsd) + compras.reduce((s, v) => s + v, 0));
  const ultimas = compras.slice(-3);
  const promedioMensual = ultimas.length ? r2(ultimas.reduce((s, v) => s + v, 0) / ultimas.length) : 0;

  let restante = total;
  let acumulado = 0;
  const metas = config.metas.map((meta): ProgresoMeta => {
    const objetivo = Math.max(0, num(meta.objetivoUsd));
    const ahorrado = r2(Math.min(objetivo, restante));
    restante = r2(restante - ahorrado);
    acumulado += objetivo;
    const falta = r2(objetivo - ahorrado);
    // Lo que falta para llegar a esta meta incluye lo que falta de las anteriores.
    const faltaAcumulada = Math.max(0, r2(acumulado - total));
    const mesesRestantes = meta.hasta ? Math.max(0, indiceMes(meta.hasta) - indiceMes(hoy)) : null;
    return {
      meta,
      ahorrado,
      falta,
      porcentaje: objetivo > 0 ? Math.min(100, (ahorrado / objetivo) * 100) : 0,
      completa: objetivo > 0 && falta === 0,
      mesesRestantes,
      necesarioPorMes: mesesRestantes && faltaAcumulada > 0 ? r2(faltaAcumulada / mesesRestantes) : null,
      mesesAlRitmo: objetivo > 0 && promedioMensual > 0 ? Math.ceil(faltaAcumulada / promedioMensual) : null,
    };
  });
  return { total, promedioMensual, metas, excedente: restante };
}
