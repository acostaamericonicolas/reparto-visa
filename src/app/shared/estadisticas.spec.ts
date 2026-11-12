import { describe, expect, it } from 'vitest';
import { Item, Resumen } from '../models/resumen';
import { MESES_RECURRENTES, cuotasPendientes, estimadoMes, gastoPorMes, proyeccionCuotas, variacion } from './estadisticas';

const personas = [{ id: 'ana', nombre: 'Ana' }, { id: 'nico', nombre: 'Nico' }];
const item = (pesos: number, extra: Partial<Item> = {}): Item => ({
  id: 'r', fecha: '01.01.26', comp: '1*', detalle: 'COMPRA', cuota: '', pesos, usd: 0, tarjeta: 'T', partes: [], ...extra,
});
const resumen = (id: string, vence: string, rows: Item[], cuotasAVencer = [] as { mes: string; pesos: number }[]): Resumen => ({
  meta: { id, cierre: '', vence, saldo: 0, saldoUsd: 0, cuotasAVencer },
  rows,
});

describe('gastoPorMes', () => {
  it('suma el gasto de cada persona por mes de vencimiento, del más viejo al más nuevo', () => {
    const oct = resumen('2026-10-01', '14 Oct 26', [item(100, { partes: [{ p: 'ana', pesos: 100, usd: 0 }] })]);
    const sep = resumen('2026-08-27', '08 Sep 26', [item(80, { partes: [{ p: 'ana', pesos: 50, usd: 0 }] })]);
    const g = gastoPorMes([oct, sep], personas);
    expect(g.etiquetas).toEqual(['Sep 26', 'Oct 26']);
    expect(g.pesos.find((s) => s.id === 'ana')?.datos).toEqual([50, 100]);
    expect(g.pesos.find((s) => s.id === '')?.datos).toEqual([30, 0]);
    expect(g.pesos.some((s) => s.id === 'nico')).toBe(false);
    expect(g.totalPesos).toEqual([80, 100]);
  });

  it('calcula la variación contra el mes anterior', () => {
    expect(variacion(120, 100)).toBeCloseTo(0.2);
    expect(variacion(50, undefined)).toBeNull();
  });
});

describe('proyeccionCuotas', () => {
  it('proyecta las cuotas que faltan por persona, sin contar dos veces las cuotas adelantadas', () => {
    const res = resumen(
      '2026-10-01',
      '14 Oct 26',
      [
        item(100, { id: 'a', cuota: '04/06', partes: [{ p: 'ana', pesos: 60, usd: 0 }, { p: 'nico', pesos: 40, usd: 0 }] }),
        item(30, { id: 'b', detalle: 'OTRA', cuota: '01/02', partes: [{ p: 'nico', pesos: 30, usd: 0 }] }),
        // Cancelación anticipada: la misma compra con varias cuotas en el mes; manda la 12/12.
        item(10, { id: 'c', detalle: 'ADELANTO', cuota: '03/12' }),
        item(10, { id: 'd', detalle: 'ADELANTO', cuota: '12/12' }),
      ],
      [{ mes: 'Octubre/26', pesos: 130 }, { mes: 'Desde Noviembre/26', pesos: 100 }],
    );
    const p = proyeccionCuotas(res, personas);
    expect(p.etiquetas).toEqual(['Nov 26', 'Dic 26']);
    expect(p.series.find((s) => s.id === 'ana')?.datos).toEqual([60, 60]);
    expect(p.series.find((s) => s.id === 'nico')?.datos).toEqual([70, 40]);
    expect(p.total).toEqual([130, 100]);
    expect(p.banco).toEqual([130, null]);
    expect(p.bancoDesde?.pesos).toBe(100);

    expect(cuotasPendientes(res, 'nico')).toEqual([
      { fecha: '01.01.26', detalle: 'COMPRA', cuota: '04/06', restantes: 2, porMes: 40, total: 80 },
      { fecha: '01.01.26', detalle: 'OTRA', cuota: '01/02', restantes: 1, porMes: 30, total: 30 },
    ]);
  });
});

describe('gastos recurrentes en la proyección', () => {
  const res = resumen('2026-10-01', '14 Oct 26', [
    item(100, { id: 'a', cuota: '05/06', partes: [{ p: 'ana', pesos: 100, usd: 0 }] }),
    item(50, { id: 'b', detalle: 'NETFLIX', recurrente: true, partes: [{ p: 'ana', pesos: 25, usd: 0 }, { p: 'nico', pesos: 25, usd: 0 }] }),
    item(0, { id: 'c', detalle: 'SPOTIFY', usd: 5, recurrente: true, partes: [{ p: 'nico', pesos: 0, usd: 5 }] }),
    // Marcado como recurrente pero en cuotas: no se suma dos veces.
    item(10, { id: 'd', detalle: 'RARO', cuota: '06/06', recurrente: true, partes: [{ p: 'nico', pesos: 10, usd: 0 }] }),
  ]);

  it('suma los recurrentes en todos los meses proyectados, al menos los mínimos aunque terminen las cuotas', () => {
    const p = proyeccionCuotas(res, personas);
    expect(p.etiquetas).toEqual(['Nov 26', 'Dic 26', 'Ene 27'].slice(0, MESES_RECURRENTES));
    expect(p.series.find((s) => s.id === 'ana')?.datos).toEqual([125, 25, 25]);
    expect(p.series.find((s) => s.id === 'nico')?.datos).toEqual([25, 25, 25]);
    expect(p.recurrentes).toBe(50);
  });

  it('lista los recurrentes de cada persona junto con sus cuotas', () => {
    expect(cuotasPendientes(res, 'nico')).toEqual([
      { fecha: '01.01.26', detalle: 'NETFLIX', cuota: '', recurrente: true, restantes: 3, porMes: 25, total: 75 },
    ]);
  });

  it('estima lo que ya se sabe de los meses que todavía no tienen resumen', () => {
    expect(estimadoMes(res, 1)).toEqual({ cuotas: 100, recurrentes: 50, recurrentesUsd: 5, total: 150 });
    expect(estimadoMes(res, 2)).toEqual({ cuotas: 0, recurrentes: 50, recurrentesUsd: 5, total: 50 });
  });
});
