import { describe, expect, it } from 'vitest';
import { TextoPdf, leerResumen } from './lector-resumen';

/** Arma los textos de una línea del PDF: [x, texto] en la altura y. */
const linea = (y: number, ...partes: [number, string][]): TextoPdf[] =>
  partes.map(([x, str]) => ({ page: 1, x, y, str }));

// Resumen de ejemplo con la misma geometría que el PDF del banco (datos inventados).
const textos: TextoPdf[] = [
  ...linea(670, [388, 'VENCIMIENTO ACTUAL'], [535, '14 Oct 26']),
  ...linea(658, [388, 'CIERRE ACTUAL'], [534, '01 Oct 26']),
  ...linea(646, [388, 'SALDO ACTUAL $'], [520, '1.000,00']),
  ...linea(634, [456, 'U$S'], [546, '20,00']),
  ...linea(522, [55, '08.09.26'], [150, 'SU PAGO EN PESOS'], [420, '500,00-'], [528, '0,00']),
  ...linea(488, [55, '14.07.25'], [100, '003094*'], [150, 'TIENDA UNO'], [268, 'C.15/18'], [425, '300,00']),
  // Negrita: el PDF repite la línea corrida 0,3 puntos.
  ...linea(480, [55, '16.07.25'], [100, '004946*'], [150, 'TIENDA DOS'], [425, '200,00']),
  ...linea(480, [55.3, '16.07.25'], [100.3, '004946*'], [150.3, 'TIENDA DOS'], [425.3, '200,00']),
  ...linea(459, [105, 'Total'], [131, 'Consumos de'], [185, '1111 2222 3333 4444'], [421, '500,00'], [528, '0,00']),
  ...linea(449, [55, '18.09.26'], [100, '918954'], [150, 'Google One'], [221, 'A48451107USD'], [305, '20,00'], [528, '20,00']),
  ...linea(441, [55, '19.09.26'], [100, '000111*'], [150, 'BONIF. CONSUMO'], [429, '50,00-']),
  ...linea(430, [55, 'TARJETA'], [89, '3929'], [110, 'Total Consumos de ANA PEREZ'], [421, '-50,00'], [528, '20,00']),
  ...linea(420, [55, '01.10.26'], [150, 'IMPUESTO DE SELLOS'], [259, '$'], [425, '10,00'], [528, '0,00']),
  ...linea(412, [55, '01.10.26'], [150, 'IVA RG 4240 21%('], [234, '100,00)'], [437, '21,00'], [528, '0,00']),
  ...linea(300, [65, 'Cuotas'], [94, 'a'], [103, 'vencer:']),
  ...linea(292, [78, 'Noviembre/26'], [124, 'Diciembre/26 Enero/27']),
  ...linea(284, [65, '$300,00'], [128, '$300,00'], [183, '$150,00']),
  ...linea(276, [65, 'A'], [73, 'partir'], [103, 'de'], [136, 'Febrero/27'], [183, '$900,00']),
];

describe('leerResumen', () => {
  const { resumen, avisos } = leerResumen(textos);

  it('lee las fechas y el saldo del encabezado', () => {
    expect(resumen.meta).toMatchObject({ id: '2026-10-01', vence: '14 Oct 26', saldo: 1000, saldoUsd: 20 });
  });

  it('deja afuera los pagos y une los duplicados de la negrita', () => {
    expect(resumen.rows.map((r) => r.detalle)).toEqual(['TIENDA UNO', 'TIENDA DOS', 'Google One', 'BONIF. CONSUMO', 'Impuestos y cargos']);
  });

  it('separa cuota, comprobante y tarjeta', () => {
    expect(resumen.rows[0]).toMatchObject({ fecha: '14.07.25', comp: '003094*', cuota: '15/18', pesos: 300, tarjeta: 'Tarjeta 4444' });
    expect(resumen.rows[3]).toMatchObject({ pesos: -50, tarjeta: 'Tarjeta 3929 · ANA PEREZ' });
  });

  it('limpia el código de referencia de los consumos en dólares', () => {
    expect(resumen.rows[2]).toMatchObject({ detalle: 'Google One', pesos: 0, usd: 20 });
  });

  it('une los impuestos en un ítem con el desglose', () => {
    const imp = resumen.rows.at(-1)!;
    expect(imp).toMatchObject({ tipo: 'impuestos', pesos: 31 });
    expect(imp.items?.map((i) => i.detalle)).toEqual(['IMPUESTO DE SELLOS $', 'IVA RG 4240 21%( 100,00)']);
  });

  it('lee las cuotas a vencer que informa el banco', () => {
    expect(resumen.meta.cuotasAVencer).toEqual([
      { mes: 'Noviembre/26', pesos: 300 },
      { mes: 'Diciembre/26', pesos: 300 },
      { mes: 'Enero/27', pesos: 150 },
      { mes: 'Desde Febrero/27', pesos: 900 },
    ]);
  });

  it('cierra contra los totales de cada tarjeta', () => {
    expect(avisos).toEqual([]);
  });

  it('avisa si un ítem no se leyó', () => {
    const sinUno = textos.filter((t) => t.str !== 'TIENDA UNO' && !(t.y === 488));
    expect(leerResumen(sinUno).avisos[0]).toContain('Tarjeta 4444');
  });

  it('rechaza un PDF que no es un resumen', () => {
    expect(() => leerResumen(linea(100, [55, 'Hola']))).toThrow();
  });
});
