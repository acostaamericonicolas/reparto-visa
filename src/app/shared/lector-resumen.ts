import { CuotaAVencer, Item, MetaResumen, Resumen, TotalTarjeta } from '../models/resumen';
import { fechaIso } from './fechas';
import { formatoMonto, montoDelResumen, r2 } from './montos';

/**
 * Lector del resumen Visa ICBC.
 *
 * Recibe los textos del PDF con su posición (como los entrega pdf.js) y arma los ítems.
 * Depende de las columnas del resumen, medidas en puntos desde el borde izquierdo:
 *   fecha ≈ 55 · comprobante ≈ 100 · detalle ≈ 150 · cuota ≈ 268 · pesos ≈ 410-445 · dólares ≈ 520-530
 * Si el banco cambia el diseño, hay que ajustar estas constantes.
 */
const X_FECHA_MAX = 85;
const X_COMPROBANTE_MAX = 140;
const X_IMPORTES_MIN = 400;
const X_DOLARES_MIN = 500;

const MONTO = /^-?[\d.]+,\d{2}-?$/;
const FECHA = /^\d{2}\.\d{2}\.\d{2}$/;
const CUOTA = /^C\.\d+\/\d+$/;

/** Líneas que no son consumos: pagos, devoluciones de percepciones y saldos. */
const NO_ES_CONSUMO = /^(SU PAGO|DEV\.IMP|SALDO|TRANSFERENCIA DEUDA)/;

export const TARJETA_IMPUESTOS = 'Impuestos y cargos';

/** Deja solo los últimos 4 dígitos de un número de tarjeta completo: "Tarjeta 1111 2222 3333 4444" → "Tarjeta 4444". */
export function ocultarNumeroTarjeta(texto: string): string {
  return texto.replace(/\b(?:\d{4}[ -]?){3}(\d{4})\b/g, '$1');
}

/** Un texto del PDF con su posición. `y` crece hacia arriba (como en pdf.js). */
export interface TextoPdf {
  page: number;
  x: number;
  y: number;
  str: string;
}

interface Linea {
  page: number;
  y: number;
  toks: { x: number; str: string }[];
  text: string;
}

export interface LecturaResumen {
  resumen: Resumen;
  /** Diferencias entre lo leído y los totales que informa el banco. Vacío = cierra todo. */
  avisos: string[];
}

/** Agrupa los textos en líneas por altura y saca los duplicados del texto en negrita. */
export function agruparLineas(textos: TextoPdf[]): Linea[] {
  const ordenados = textos
    .filter((t) => t.str && t.str.trim())
    .slice()
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lineas: Linea[] = [];
  for (const t of ordenados) {
    let linea = lineas.find((l) => l.page === t.page && Math.abs(l.y - t.y) <= 1.5);
    if (!linea) {
      linea = { page: t.page, y: t.y, toks: [], text: '' };
      lineas.push(linea);
    }
    // El PDF dibuja la negrita repitiendo el texto corrido unas décimas de punto.
    if (linea.toks.some((k) => k.str === t.str.trim() && Math.abs(k.x - t.x) < 1.5)) continue;
    linea.toks.push({ x: t.x, str: t.str.trim() });
  }
  lineas.sort((a, b) => a.page - b.page || b.y - a.y);
  for (const l of lineas) {
    l.toks.sort((a, b) => a.x - b.x);
    l.text = l.toks.map((k) => k.str).join(' ');
  }
  return lineas;
}

/** Saca del detalle los códigos de referencia y el importe en moneda de origen de los consumos en dólares. */
function limpiarDetalle(texto: string): string {
  return texto
    .replace(/\s*[A-Z]?\d*USD\s+[\d.]+,\d{2}/g, '')
    .replace(/\b[A-Z]?\d{10,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function importes(toks: { x: number; str: string }[]): { pesos: number; usd: number } {
  let pesos = 0;
  let usd = 0;
  for (const k of toks) {
    if (k.x < X_IMPORTES_MIN || !MONTO.test(k.str)) continue;
    if (k.x < X_DOLARES_MIN) pesos = montoDelResumen(k.str);
    else usd = montoDelResumen(k.str);
  }
  return { pesos, usd };
}

export function leerResumen(textos: TextoPdf[]): LecturaResumen {
  const lineas = agruparLineas(textos);
  const meta: Partial<MetaResumen> = {};
  const totalesTarjeta: TotalTarjeta[] = [];
  const rows: Item[] = [];
  let pendientes: Omit<Item, 'id' | 'tarjeta' | 'partes'>[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const t = l.text;

    meta.cierre ??= /CIERRE ACTUAL\s+(\d{2} \w{3} \d{2})/.exec(t)?.[1];
    meta.vence ??= /VENCIMIENTO ACTUAL\s+(\d{2} \w{3} \d{2})/.exec(t)?.[1];
    if (meta.saldo === undefined) {
      const m = /SALDO ACTUAL \$\s+([\d.]+,\d{2})/.exec(t);
      if (m) meta.saldo = montoDelResumen(m[1]);
    } else if (meta.saldoUsd === undefined) {
      const m = /^U\$S\s+([\d.]+,\d{2})$/.exec(t);
      if (m) meta.saldoUsd = montoDelResumen(m[1]);
    }

    const primero = l.toks[0];
    if (primero && primero.x < X_FECHA_MAX && FECHA.test(primero.str)) {
      let comp = '';
      let cuota = '';
      const detalle: string[] = [];
      for (const k of l.toks.slice(1)) {
        if (k.x >= X_IMPORTES_MIN && MONTO.test(k.str)) continue;
        if (k.x < X_COMPROBANTE_MAX && !detalle.length) comp = k.str;
        else if (CUOTA.test(k.str)) cuota = k.str.slice(2);
        else detalle.push(k.str);
      }
      const texto = limpiarDetalle(detalle.join(' '));
      if (NO_ES_CONSUMO.test(texto)) continue;
      pendientes.push({ fecha: primero.str, comp, detalle: texto, cuota, ...importes(l.toks) });
      continue;
    }

    // "Total Consumos de ..." cierra el bloque de una tarjeta: los ítems leídos hasta acá son de ella.
    if (/Total\s+Consumos de/.test(t)) {
      const nombre = /Consumos de\s+(.+?)\s+-?[\d.]+,\d{2}/.exec(t)?.[1] ?? '';
      const numero = /TARJETA\s+(\d{4})/.exec(t)?.[1];
      const tarjeta = ocultarNumeroTarjeta(
        (numero ? `Tarjeta ${numero} · ${nombre}` : /^[\d ]+$/.test(nombre) ? `Tarjeta ${nombre}` : nombre).trim() ||
          'Tarjeta',
      );
      totalesTarjeta.push({ tarjeta, ...importes(l.toks) });
      for (const p of pendientes) rows.push({ ...p, id: '', tarjeta, partes: [] });
      pendientes = [];
      continue;
    }

    if (/^Cuotas a vencer:?$/i.test(t)) {
      meta.cuotasAVencer = leerCuotasAVencer(lineas.slice(i + 1, i + 4));
    }
  }

  // Lo que queda después del último total son los impuestos y cargos: van en un solo ítem.
  if (pendientes.length) {
    rows.push({
      id: '',
      fecha: pendientes[pendientes.length - 1].fecha,
      comp: '',
      detalle: TARJETA_IMPUESTOS,
      cuota: '',
      tarjeta: TARJETA_IMPUESTOS,
      tipo: 'impuestos',
      pesos: r2(pendientes.reduce((s, p) => s + p.pesos, 0)),
      usd: r2(pendientes.reduce((s, p) => s + p.usd, 0)),
      items: pendientes.map((p) => ({ fecha: p.fecha, detalle: p.detalle, pesos: p.pesos, usd: p.usd })),
      partes: [],
    });
  }
  rows.forEach((r, i) => (r.id = 'r' + i));

  const id = fechaIso(meta.cierre);
  if (!id || !rows.length) throw new Error('No se encontraron movimientos: el PDF no parece un resumen Visa ICBC.');

  return {
    resumen: {
      meta: {
        id,
        cierre: meta.cierre!,
        vence: meta.vence ?? '',
        saldo: meta.saldo ?? 0,
        saldoUsd: meta.saldoUsd ?? 0,
        totalesTarjeta,
        cuotasAVencer: meta.cuotasAVencer ?? [],
      },
      rows,
    },
    avisos: controlarTotales(rows, totalesTarjeta),
  };
}

/** Línea de meses ("Octubre/26 Noviembre/26 ..."), línea de importes y "A partir de Abril/27 $..." */
function leerCuotasAVencer(siguientes: Linea[]): CuotaAVencer[] {
  const [lMeses, lMontos, lResto] = siguientes;
  if (!lMeses || !lMontos) return [];
  const meses = lMeses.text.split(/\s+/).filter((s) => /^\p{L}+\/\d{2}$/u.test(s));
  const montos = lMontos.text.split(/\s+/).filter((s) => /^\$[\d.]+,\d{2}$/.test(s));
  const cuotas = meses.map((mes, k) => ({ mes, pesos: montos[k] ? montoDelResumen(montos[k].slice(1)) : 0 }));
  const desde = lResto && /A partir de\s+(\p{L}+\/\d{2})\s+\$([\d.]+,\d{2})/u.exec(lResto.text);
  if (desde) cuotas.push({ mes: 'Desde ' + desde[1], pesos: montoDelResumen(desde[2]) });
  return cuotas;
}

function controlarTotales(rows: Item[], totales: TotalTarjeta[]): string[] {
  const avisos: string[] = [];
  for (const t of totales) {
    const suyos = rows.filter((r) => r.tarjeta === t.tarjeta);
    const pesos = r2(suyos.reduce((s, r) => s + r.pesos, 0));
    const usd = r2(suyos.reduce((s, r) => s + r.usd, 0));
    if (Math.abs(pesos - t.pesos) > 0.009 || Math.abs(usd - t.usd) > 0.009) {
      avisos.push(
        `${t.tarjeta}: los ítems suman $ ${formatoMonto(pesos)} y U$S ${formatoMonto(usd)}, ` +
          `pero el banco informa $ ${formatoMonto(t.pesos)} y U$S ${formatoMonto(t.usd)}.`,
      );
    }
  }
  return avisos;
}
