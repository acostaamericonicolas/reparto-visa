import { describe, expect, it } from 'vitest';
import { Item, Resumen } from '../models/resumen';
import { ajustarParte, arrastrar, claveRecurrente, dividir, falta, quitarParte, ordenarPersonas, totalesPorPersona, visibleEn } from './reparto';
import { montoIngresado, repartoIgual } from './montos';
import { detalleDePersona } from './detalle-persona';
import { mesesFuturos } from './fechas';

const item = (pesos: number, extra: Partial<Item> = {}): Item => ({
  id: 'r0', fecha: '01.01.26', comp: '1*', detalle: 'COMPRA', cuota: '', pesos, usd: 0, tarjeta: 'T', partes: [], ...extra,
});
const resumen = (rows: Item[], cierre = '01 Ene 26'): Resumen => ({
  meta: { id: '2026-01-01', cierre, vence: '', saldo: 0, saldoUsd: 0 },
  rows,
});
const montos = (r: Item) => r.partes.map((p) => p.pesos);

describe('montos', () => {
  it('reparte en partes iguales y los centavos van a las primeras', () => {
    expect(repartoIgual(10, 3)).toEqual([3.34, 3.33, 3.33]);
  });

  it('entiende los formatos que se escriben a mano', () => {
    expect(montoIngresado('40.000,50')).toBe(40000.5);
    expect(montoIngresado('40000.5')).toBe(40000.5);
    expect(montoIngresado('40.000')).toBe(40000);
    expect(montoIngresado('$ 1.234')).toBe(1234);
  });
});

describe('ajustarParte', () => {
  const base = (n: number) => {
    const r = item(50);
    r.partes = dividir(r, n);
    return r;
  };

  it('reparte lo que falta entre las partes siguientes', () => {
    expect(ajustarParte(base(2), 0, 30).map((p) => p.pesos)).toEqual([30, 20]);
    expect(ajustarParte(base(3), 0, 30).map((p) => p.pesos)).toEqual([30, 10, 10]);
  });

  it('si se edita la última, ajusta las anteriores', () => {
    expect(ajustarParte(base(3), 2, 20).map((p) => p.pesos)).toEqual([15, 15, 20]);
  });

  it('si el monto supera el total, las otras quedan en cero', () => {
    expect(ajustarParte(base(3), 0, 60).map((p) => p.pesos)).toEqual([60, 0, 0]);
  });
});

describe('quitarParte', () => {
  it('pasa el monto de la parte quitada a la última', () => {
    const r = item(90);
    r.partes = [{ p: 'a', pesos: 30, usd: 0 }, { p: 'b', pesos: 30, usd: 0 }, { p: 'c', pesos: 30, usd: 0 }];
    expect(montos({ ...r, partes: quitarParte(r, 0) })).toEqual([30, 60]);
  });
});

describe('arrastrar', () => {
  it('copia el dueño de la misma compra en otro mes', () => {
    const anterior = item(100, { cuota: '01/03', partes: [{ p: 'ana', pesos: 100, usd: 0 }] });
    const nuevo = item(100, { cuota: '02/03' });
    expect(arrastrar([nuevo], [resumen([anterior], '01 Dic 25')])).toBe(1);
    expect(nuevo.partes).toEqual([{ p: 'ana', pesos: 100, usd: 0 }]);
    expect(nuevo.origen).toBe('01 Dic 25');
  });

  it('ajusta en proporción un reparto dividido si cambió el monto', () => {
    const anterior = item(61750, {
      partes: [{ p: 'ana', pesos: 25000, usd: 0 }, { p: 'nico', pesos: 36750, usd: 0 }],
    });
    const nuevo = item(61666.16);
    arrastrar([nuevo], [resumen([anterior])]);
    expect(montos(nuevo).reduce((a, b) => a + b, 0)).toBeCloseTo(61666.16, 2);
    expect(nuevo.partes[0].pesos).toBeCloseTo(24966.06, 2);
  });

  it('no toca lo que ya está asignado y usa el dueño de la tarjeta si no hay otro mes', () => {
    const asignado = item(10, { id: 'a', partes: [{ p: 'eli', pesos: 10, usd: 0 }] });
    const deTarjeta = item(20, { id: 'b', detalle: 'OTRA' });
    arrastrar([asignado, deTarjeta], [], { T: 'nanu' });
    expect(asignado.partes[0].p).toBe('eli');
    expect(deTarjeta.partes[0].p).toBe('nanu');
  });
});

describe('gastos recurrentes', () => {
  const netflix = (pesos: number, extra: Partial<Item> = {}) => item(pesos, { detalle: 'NETFLIX.COM', ...extra });

  it('reconoce el mismo gasto aunque cambien la fecha, el comprobante y los números del detalle', () => {
    expect(claveRecurrente(item(1, { detalle: 'SPOTIFY P2A3B4', fecha: '03.02.26', comp: '9*' }))).toBe(
      claveRecurrente(item(1, { detalle: 'SPOTIFY  P7A8B9' })),
    );
    expect(claveRecurrente(item(1, { detalle: 'SPOTIFY', tarjeta: 'OTRA' }))).not.toBe(claveRecurrente(item(1, { detalle: 'SPOTIFY' })));
  });

  it('al importar el mes siguiente, lo marca como recurrente y copia el reparto aunque cambie el monto', () => {
    const anterior = netflix(10000, {
      recurrente: true,
      partes: [{ p: 'ana', pesos: 5000, usd: 0 }, { p: 'nico', pesos: 5000, usd: 0 }],
    });
    const nuevo = netflix(12000, { id: 'n', fecha: '03.02.26', comp: '77*' });
    expect(arrastrar([nuevo], [resumen([anterior], '01 Ene 26')], { T: 'eli' })).toBe(1);
    expect(nuevo.recurrente).toBe(true);
    expect(nuevo.partes).toEqual([{ p: 'ana', pesos: 6000, usd: 0 }, { p: 'nico', pesos: 6000, usd: 0 }]);
    expect(nuevo.origen).toBe('01 Ene 26');
  });

  it('manda la última vez que apareció: si se desmarcó, ya no se arrastra', () => {
    const viejo = netflix(100, { recurrente: true, partes: [{ p: 'ana', pesos: 100, usd: 0 }] });
    const desmarcado = netflix(100, { recurrente: false, partes: [{ p: 'ana', pesos: 100, usd: 0 }] });
    const nuevo = netflix(100, { fecha: '03.03.26' });
    expect(arrastrar([nuevo], [resumen([viejo], '01 Ene 26'), resumen([desmarcado], '01 Feb 26')])).toBe(0);
    expect(nuevo.recurrente).toBeUndefined();
    expect(nuevo.partes).toEqual([]);
  });

  it('no marca compras en cuotas ni pisa lo que ya está asignado o desmarcado a mano', () => {
    const anterior = netflix(100, { recurrente: true, partes: [{ p: 'ana', pesos: 100, usd: 0 }] });
    const enCuotas = netflix(100, { id: 'c', cuota: '01/03', fecha: '03.02.26' });
    const asignado = netflix(100, { id: 'a', fecha: '04.02.26', partes: [{ p: 'nico', pesos: 100, usd: 0 }] });
    const desmarcado = netflix(100, { id: 'd', fecha: '05.02.26', recurrente: false });
    arrastrar([enCuotas, asignado, desmarcado], [resumen([anterior])]);
    expect(enCuotas.recurrente).toBeUndefined();
    expect(enCuotas.partes).toEqual([]);
    expect(asignado.recurrente).toBe(true);
    expect(asignado.partes[0].p).toBe('nico');
    expect(desmarcado.recurrente).toBe(false);
    expect(desmarcado.partes).toEqual([]);
  });
});

describe('totales', () => {
  it('suma por persona y cuenta lo que falta asignar', () => {
    const r1 = item(100, { partes: [{ p: 'ana', pesos: 60, usd: 0 }, { p: '', pesos: 40, usd: 0 }] });
    const r2 = item(50, { id: 'r1' });
    const t = totalesPorPersona(resumen([r1, r2]), [{ id: 'ana', nombre: 'Ana' }]);
    expect(t.get('ana')).toEqual({ pesos: 60, usd: 0, items: 1 });
    expect(t.get('')).toEqual({ pesos: 90, usd: 0, items: 2 });
    expect(falta(r1).pesos).toBe(40);
  });
});

describe('detalleDePersona', () => {
  it('agrega el vencimiento menos 2 días y el alias al final', () => {
    const r = item(100, { cuota: '04/09', partes: [{ p: 'eli', pesos: 100, usd: 0 }] });
    const res: Resumen = { meta: { id: '2026-10-01', cierre: '01 Oct 26', vence: '14 Oct 26', saldo: 0, saldoUsd: 0 }, rows: [r] };
    const texto = detalleDePersona(res, { id: 'eli', nombre: 'Eli' }, ' mi.alias ');
    expect(texto.split('\n').slice(-4)).toEqual(['Total: $ 100,00', '', 'Vence el 12/10', 'Alias: mi.alias']);
  });

  it('cruza de mes y omite el alias si no hay', () => {
    const res: Resumen = { meta: { id: '2026-08-27', cierre: '27 Ago 26', vence: '01 Sep 26', saldo: 0, saldoUsd: 0 }, rows: [] };
    expect(detalleDePersona(res, { id: 'eli', nombre: 'Eli' }).split('\n').at(-1)).toBe('Vence el 30/08');
  });
});

describe('ordenarPersonas', () => {
  const p = (id: string) => ({ id, nombre: id });
  const t = (pesos: number, items = 1, usd = 0) => ({ pesos, usd, items });
  it('de mayor a menor, las que pagaron al final y las sin ítems al fondo', () => {
    const totales = new Map([['a', t(100)], ['b', t(300)], ['c', t(200)], ['d', t(0, 0)], ['e', t(100, 1, 5)]]);
    const orden = ordenarPersonas([p('a'), p('b'), p('c'), p('d'), p('e')], totales, { b: { avisado: true, pagado: true } });
    expect(orden.map((x) => x.id)).toEqual(['c', 'e', 'a', 'b', 'd']);
  });
});

describe('mesesFuturos', () => {
  it('muestra los dos meses que siguen al último resumen cargado', () => {
    expect(mesesFuturos('2026-10')).toEqual(['2026-11', '2026-12']);
    expect(mesesFuturos('2026-12')).toEqual(['2027-01', '2027-02']);
  });
});

describe('visibleEn', () => {
  const solo = item(100, { partes: [{ p: 'eli', pesos: 100, usd: 0 }] });
  const dividido = item(100, { partes: [{ p: 'eli', pesos: 50, usd: 0 }, { p: 'pool', pesos: 50, usd: 0 }] });
  const nuevo = item(100);
  const filas = [solo, dividido, nuevo];
  const cuantos = (f: string) => filas.filter((r) => visibleEn(r, f)).length;

  it('cuenta los movimientos de cada filtro', () => {
    expect(cuantos('todos')).toBe(3);
    expect(cuantos('eli')).toBe(2);
    expect(cuantos('pool')).toBe(1);
    expect(cuantos('')).toBe(1);
    expect(cuantos('nadie')).toBe(0);
  });
});
