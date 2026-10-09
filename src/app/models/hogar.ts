/**
 * Gastos del hogar de dos personas ("nico" y "nanu" son solo las claves de las dos personas; sus nombres
 * reales salen de las personas de Reparto Visa elegidas en Ajustes).
 */
export type Quien = 'nico' | 'nanu';

/** Quién adelantó un gasto: la cuenta común o una de las dos personas. */
export type Pago = 'pozo' | Quien;

export interface GastoCompartido {
  id: string;
  concepto: string;
  categoria: string;
  /** Lo que se espera gastar; 0 = sin estimado. */
  estimado: number;
  /** Lo gastado; `null` = todavía sin cargar (el cálculo usa el estimado). */
  real: number | null;
  pagadoPor: Pago;
  /** Se repite todos los meses: pasa solo al mes siguiente. Los gastos de una sola vez no. */
  recurrente: boolean;
}

export interface AhorroUsd {
  planificados: number;
  /** `null` = todavía sin comprar (el cálculo usa los planificados). */
  comprados: number | null;
  cotizacion: number;
  pagadoPor: Pago;
}

/** De qué resumen de la tarjeta se tomaron los totales del mes. */
export interface OrigenTarjetas {
  cierre: string;
  vence: string;
  total: number;
  otros: number;
  sinAsignar: number;
  usd: Record<Quien, number>;
}

export interface MesHogar {
  ingresos: Record<Quien, number>;
  usd: AhorroUsd;
  gastos: GastoCompartido[];
  /** Total de la tarjeta de cada uno en el mes (pesos). */
  tarjetas: Record<Quien, number>;
  tarjetasOrigen?: OrigenTarjetas;
  notas: string;
}

/** Algo para lo que se ahorra en dólares. Las metas se completan en orden: lo ahorrado llena primero la primera. */
export interface MetaAhorro {
  id: string;
  nombre: string;
  objetivoUsd: number;
  /** Mes ("yyyy-mm") en que se quiere tenerla, si hay fecha. */
  hasta: string;
}

/** Documento `hogar/config`. */
export interface ConfigHogar {
  categorias: string[];
  metas: MetaAhorro[];
  /** Dólares que ya había ahorrados antes de empezar a registrar los meses acá. */
  ahorroInicialUsd: number;
  /** Id de la persona de Reparto Visa (`config/app`) que es cada uno; '' = sin elegir. */
  personas: Record<Quien, string>;
}

export interface RespaldoHogar {
  formato: 'hogar-respaldo';
  version: 1;
  exportado: string;
  config: ConfigHogar;
  meses: Record<string, MesHogar>;
}

export const CATEGORIAS_INICIALES = ['Comida', 'Servicios', 'Transporte', 'Seguros', 'Hogar', 'Salidas', 'Salud', 'Otros'];
export const CATEGORIA_AHORRO = 'Ahorro USD';
