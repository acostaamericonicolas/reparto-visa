/** Parte de un ítem asignada a una persona. `p` vacío = parte todavía sin dueño. */
export interface Parte {
  p: string;
  pesos: number;
  usd: number;
}

/** Concepto suelto dentro del ítem unificado de impuestos y cargos. */
export interface ConceptoImpuesto {
  fecha: string;
  detalle: string;
  pesos: number;
  usd: number;
}

/** Un renglón del resumen (consumo, cuota o el ítem unificado de impuestos). */
export interface Item {
  id: string;
  fecha: string;
  comp: string;
  detalle: string;
  /** "05/12" o vacío si es en un pago. */
  cuota: string;
  pesos: number;
  usd: number;
  tarjeta: string;
  partes: Parte[];
  tipo?: 'impuestos';
  items?: ConceptoImpuesto[];
  /** Cierre del mes del que se copió el reparto, si se autocompletó. */
  origen?: string;
}

/** Total que el banco informa por tarjeta, para controlar la lectura del PDF. */
export interface TotalTarjeta {
  tarjeta: string;
  pesos: number;
  usd: number;
}

/** Cuotas a vencer según el banco, en el orden en que las informa. */
export interface CuotaAVencer {
  mes: string;
  pesos: number;
}

export interface MetaResumen {
  /** Fecha de cierre en formato ISO (yyyy-mm-dd); es el id del documento. */
  id: string;
  cierre: string;
  vence: string;
  saldo: number;
  saldoUsd: number;
  totalesTarjeta?: TotalTarjeta[];
  cuotasAVencer?: CuotaAVencer[];
}

/** Seguimiento del cobro a una persona en un mes. */
export interface EstadoPersona {
  /** Ya se le avisó cuánto tiene que pagar. */
  avisado: boolean;
  /** Ya pagó. */
  pagado: boolean;
}

export interface Resumen {
  meta: MetaResumen;
  rows: Item[];
  importado?: string;
  /** Por id de persona. Si falta, todavía no se le avisó ni pagó. */
  estados?: Record<string, EstadoPersona>;
}

export type Moneda = 'pesos' | 'usd';
