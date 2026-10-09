/**
 * Gastos del hogar de dos personas ("nico" y "nanu" son solo las claves de las dos personas; sus nombres
 * reales salen de las personas de Reparto Visa elegidas en Ajustes).
 */
export type Quien = 'nico' | 'nanu';

/**
 * Quién pagó un gasto compartido: la cuenta común, una de las dos personas (de su bolsillo) o con la tarjeta
 * de una de ellas. Lo que va en la tarjeta ya está dentro del total de esa tarjeta, así que no se cuenta dos veces.
 */
export type Pago = 'pozo' | Quien | `tarjeta-${Quien}`;

/** Plata extra que se cobra un mes (aguinaldo, bono…), además del sueldo. */
export interface ExtraIngreso {
  id: string;
  concepto: string;
  monto: number;
}

/** Gasto propio de una persona (no compartido): lo que no pasa por la cuenta común ni por la tarjeta. */
export interface GastoIndividual {
  id: string;
  /** "2026-10-14" */
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
}

/** Un pago suelto de un gasto que se paga en varias veces (la nafta, el súper…). */
export interface PagoParcial {
  id: string;
  /** "2026-10-14" */
  fecha: string;
  monto: number;
  pagadoPor: Pago;
}

export interface GastoCompartido {
  id: string;
  concepto: string;
  categoria: string;
  /** Lo que se espera gastar; 0 = sin estimado. */
  estimado: number;
  /** Lo gastado hasta ahora; `null` = todavía nada. Si hay `pagos`, es su suma. */
  real: number | null;
  /** Quién lo paga (o la tarjeta). Cada pago parcial puede tener el suyo. */
  pagadoPor: Pago;
  /** Pagos sueltos que suman el real, para lo que se paga en partes. */
  pagos: PagoParcial[];
  /** Ya está todo pagado o comprado: el monto final es el real. Mientras no, se espera al menos el estimado. */
  pagado: boolean;
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
  /** Sueldo de cada uno. */
  ingresos: Record<Quien, number>;
  /** Extras del mes (aguinaldo, bono…) que se suman al sueldo. */
  extras: Record<Quien, ExtraIngreso[]>;
  usd: AhorroUsd;
  gastos: GastoCompartido[];
  /** Total de la tarjeta de cada uno en el mes (pesos). */
  tarjetas: Record<Quien, number>;
  /** Ya se pagó el resumen de la tarjeta de cada uno. */
  tarjetasPagadas: Record<Quien, boolean>;
  tarjetasOrigen?: OrigenTarjetas;
  /** Gastos propios de cada uno, para saber cuánto le queda de lo libre. */
  individuales: Record<Quien, GastoIndividual[]>;
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
