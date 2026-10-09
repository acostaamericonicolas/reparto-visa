import { describe, expect, it } from 'vitest';
import { GastoCompartido, MesHogar } from '../models/hogar';
import { Item, Resumen } from '../models/resumen';
import { calcularMes, estadoGasto, estimadoVsReal, mesAnterior, mesNuevo, resumenDelMes, totalesDeTarjeta, variacionGasto } from './hogar';

const gasto = (concepto: string, categoria: string, real: number | null, extra: Partial<GastoCompartido> = {}): GastoCompartido => ({
  id: concepto, concepto, categoria, estimado: 0, real, pagadoPor: 'pozo', recurrente: true, ...extra,
});

/** Octubre real: sueldos 2.8M y 1.4M, 700 USD a 1530, tarjetas 700.000 y 560.000. */
const octubre = (): MesHogar => ({
  ingresos: { nico: 2_800_000, nanu: 1_400_000 },
  usd: { planificados: 700, comprados: 700, cotizacion: 1530, pagadoPor: 'nanu' },
  gastos: [
    gasto('Luz', 'Servicios', 29_000), gasto('Mamasha', 'Otros', 50_000), gasto('Nafta', 'Transporte', 150_000),
    gasto('Huevo', 'Comida', 21_000), gasto('Súper', 'Comida', 300_000), gasto('Seguros autos', 'Seguros', 378_000),
    gasto('Sin detalle', 'Otros', 287_200),
  ],
  tarjetas: { nico: 700_000, nanu: 560_000 },
  notas: '',
});

describe('calcularMes', () => {
  it('da los mismos números que la planilla de octubre', () => {
    const r = calcularMes(octubre());
    expect(r.compartidos).toBe(2_286_200);
    expect(r.pozo).toBe(1_913_800);
    expect(r.libre).toBe(326_900);
    expect(r.nico.aporte).toBe(1_773_100);
    expect(r.nanu.aporte).toBe(513_100);
  });

  it('los aportes siempre suman los gastos compartidos', () => {
    const r = calcularMes(octubre());
    expect(r.nico.aporte + r.nanu.aporte).toBe(r.compartidos);
  });

  it('descuenta lo que cada uno adelantó: quien pagó los dólares recibe', () => {
    const r = calcularMes(octubre());
    expect(r.nanu.adelantado).toBe(1_071_000);
    expect(r.nanu.neto).toBe(-557_900);
    expect(r.nico.neto).toBe(1_773_100);
  });

  it('usa el estimado mientras el real no se cargó', () => {
    const m = octubre();
    m.gastos[0] = gasto('Luz', 'Servicios', null, { estimado: 30_000 });
    expect(calcularMes(m).gastos).toBe(2_286_200 - 29_000 - 1_071_000 + 30_000);
  });

  it('usa los dólares planificados hasta que se compran', () => {
    const m = octubre();
    m.usd.comprados = null;
    m.usd.planificados = 800;
    expect(calcularMes(m).usdEnPesos).toBe(1_224_000);
  });
});

describe('estimadoVsReal', () => {
  it('marca como pasada la categoría que supera lo estimado', () => {
    const m = octubre();
    m.gastos[4].estimado = 250_000; // Súper: estimado 250.000, real 300.000
    const comida = estimadoVsReal(m).filas.find((f) => f.nombre === 'Comida')!;
    expect(comida.estimado).toBe(250_000);
    expect(comida.real).toBe(321_000);
    expect(comida.pasado).toBe(true);
  });

  it('no marca categorías sin estimado ni el ahorro', () => {
    const m = octubre();
    m.usd.planificados = 500; // compraron más de lo planificado
    const filas = estimadoVsReal(m).filas;
    expect(filas.some((f) => f.pasado)).toBe(false);
    expect(filas.find((f) => f.ahorro)?.diferencia).toBe(306_000);
  });

  it('cuenta los gastos con estimado y sin real', () => {
    const m = octubre();
    m.gastos[0] = gasto('Luz', 'Servicios', null, { estimado: 30_000 });
    expect(estimadoVsReal(m).pendientes).toBe(1);
  });
});

describe('estadoGasto', () => {
  it('informa cuánto se pasó', () => {
    expect(estadoGasto(gasto('x', 'Otros', 120, { estimado: 100 }))).toEqual({ pasado: true, diferencia: 20 });
    expect(estadoGasto(gasto('x', 'Otros', 80, { estimado: 100 }))).toEqual({ pasado: false, diferencia: -20 });
    expect(estadoGasto(gasto('x', 'Otros', 80))).toEqual({ pasado: false, diferencia: 0 });
    expect(estadoGasto(gasto('x', 'Otros', null, { estimado: 100 }))).toEqual({ pasado: false, diferencia: 0 });
  });
});

describe('mesNuevo', () => {
  it('lo gastado pasa a ser el estimado y el real queda pendiente', () => {
    const nuevo = mesNuevo(octubre(), () => 'nuevo');
    expect(nuevo.gastos[0]).toMatchObject({ estimado: 29_000, real: null });
    expect(nuevo.usd).toMatchObject({ planificados: 700, comprados: null, cotizacion: 1530 });
    expect(nuevo.tarjetas).toEqual({ nico: 0, nanu: 0 });
    expect(nuevo.ingresos.nico).toBe(2_800_000);
  });

  it('los gastos de una sola vez no pasan al mes siguiente', () => {
    const m = octubre();
    m.gastos.push(gasto('Arreglo del auto', 'Transporte', 80_000, { recurrente: false }));
    const nuevo = mesNuevo(m, () => 'n');
    expect(nuevo.gastos.map((g) => g.concepto)).not.toContain('Arreglo del auto');
    expect(nuevo.gastos).toHaveLength(7);
  });

  it('el anterior es el mes más cercano hacia atrás', () => {
    expect(mesAnterior(['2026-08', '2026-10', '2026-09'], '2026-10')).toBe('2026-09');
    expect(mesAnterior(['2026-10'], '2026-10')).toBeUndefined();
  });
});

describe('variacionGasto', () => {
  const anterior = octubre();

  it('informa cuánto subió o bajó contra el mes anterior, buscando por concepto', () => {
    expect(variacionGasto(gasto('luz', 'Servicios', 36_250), anterior)).toBe(25);
    expect(variacionGasto(gasto('Luz', 'Servicios', 26_100), anterior)).toBe(-10);
  });

  it('no compara si falta el mes anterior, el real o el gasto no existía', () => {
    expect(variacionGasto(gasto('Luz', 'Servicios', 30_000), undefined)).toBeNull();
    expect(variacionGasto(gasto('Luz', 'Servicios', null, { estimado: 29_000 }), anterior)).toBeNull();
    expect(variacionGasto(gasto('Gimnasio', 'Salud', 10_000), anterior)).toBeNull();
  });
});

// ---------- Tarjeta ----------

const parte = (p: string, pesos: number, usd = 0) => ({ p, pesos, usd });
const renglon = (pesos: number, partes: Item['partes'], usd = 0): Item => ({
  id: 'r', fecha: '01.01.26', comp: '1*', detalle: 'X', cuota: '', pesos, usd, tarjeta: 'T', partes,
});
const resumen = (id: string, vence: string, rows: Item[]): Resumen => ({
  meta: { id, cierre: '30 Sep 26', vence, saldo: 0, saldoUsd: 0 },
  rows,
});
const personas = { nico: { id: 'a', nombre: 'Nico' }, nanu: { id: 'b', nombre: 'Nanu' } };

describe('resumenDelMes', () => {
  it('elige el resumen que vence en el mes (el texto del banco es "14 Oct 26")', () => {
    const rs = { '2026-09-30': resumen('2026-09-30', '14 Oct 26', []), '2026-08-31': resumen('2026-08-31', '12 Sep 26', []) };
    expect(resumenDelMes(rs, '2026-10')?.meta.id).toBe('2026-09-30');
    expect(resumenDelMes(rs, '2026-11')).toBeNull();
  });
});

describe('totalesDeTarjeta', () => {
  const res = resumen('2026-09-30', '14 Oct 26', [
    renglon(1000, [parte('a', 1000)]),
    renglon(600, [parte('a', 300), parte('b', 300)]),
    renglon(500, [parte('c', 500)]),
    renglon(200, []),
    renglon(0, [parte('b', 0, 50)], 50),
  ]);

  it('toma solo la parte de cada uno', () => {
    const t = totalesDeTarjeta(res, personas);
    expect(t.tarjetas).toEqual({ nico: 1300, nanu: 300 });
  });

  it('informa lo de otras personas, lo sin asignar y los dólares, sin sumarlos', () => {
    const { origen } = totalesDeTarjeta(res, personas);
    expect(origen.total).toBe(2300);
    expect(origen.otros).toBe(500);
    expect(origen.sinAsignar).toBe(200);
    expect(origen.usd).toEqual({ nico: 0, nanu: 50 });
  });
});
