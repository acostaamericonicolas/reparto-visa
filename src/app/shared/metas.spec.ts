import { describe, expect, it } from 'vitest';
import { MesHogar, MetaAhorro } from '../models/hogar';
import { progresoAhorro } from './metas';

const mes = (comprados: number | null): MesHogar => ({
  ingresos: { nico: 0, nanu: 0 },
  extras: { nico: [], nanu: [] },
  individuales: { nico: [], nanu: [] },
  usd: { planificados: 700, comprados, cotizacion: 1500, pagadoPor: 'pozo' },
  gastos: [],
  tarjetas: { nico: 0, nanu: 0 },
  tarjetasPagadas: { nico: false, nanu: false },
  notas: '',
});
const meta = (id: string, objetivoUsd: number, hasta = ''): MetaAhorro => ({ id, nombre: id, objetivoUsd, hasta });

describe('progresoAhorro', () => {
  const meses = { '2026-08': mes(700), '2026-09': mes(800), '2026-10': mes(900), '2026-11': mes(null) };

  it('suma lo inicial y los dólares comprados; los planificados todavía no cuentan', () => {
    const r = progresoAhorro({ metas: [], ahorroInicialUsd: 1000 }, meses, '2026-10');
    expect(r.total).toBe(3400);
    expect(r.promedioMensual).toBe(800);
  });

  it('llena las metas en orden', () => {
    const r = progresoAhorro({ metas: [meta('emergencia', 3000), meta('casa', 50_000)], ahorroInicialUsd: 1000 }, meses, '2026-10');
    expect(r.metas[0]).toMatchObject({ ahorrado: 3000, falta: 0, completa: true, porcentaje: 100 });
    expect(r.metas[1]).toMatchObject({ ahorrado: 400, falta: 49_600, completa: false });
    expect(r.excedente).toBe(0);
  });

  it('calcula los meses que faltan al ritmo de los últimos 3 meses', () => {
    const r = progresoAhorro({ metas: [meta('casa', 10_000)], ahorroInicialUsd: 0 }, meses, '2026-10');
    expect(r.metas[0].falta).toBe(7600);
    expect(r.metas[0].mesesAlRitmo).toBe(10); // 7600 / 800 = 9,5
  });

  it('con fecha, dice cuánto hay que ahorrar por mes para llegar', () => {
    const r = progresoAhorro({ metas: [meta('casa', 10_000, '2027-10')], ahorroInicialUsd: 0 }, meses, '2026-10');
    expect(r.metas[0].mesesRestantes).toBe(12);
    expect(r.metas[0].necesarioPorMes).toBeCloseTo(633.33, 2);
  });

  it('sin objetivo definido solo muestra lo ahorrado, sin porcentaje ni plazos', () => {
    const r = progresoAhorro({ metas: [meta('casa', 0)], ahorroInicialUsd: 0 }, meses, '2026-10');
    expect(r.metas[0]).toMatchObject({ porcentaje: 0, completa: false, mesesAlRitmo: null });
    expect(r.excedente).toBe(2400);
  });

  it('sin compras todavía no hay ritmo', () => {
    const r = progresoAhorro({ metas: [meta('casa', 1000)], ahorroInicialUsd: 0 }, {}, '2026-10');
    expect(r.promedioMensual).toBe(0);
    expect(r.metas[0].mesesAlRitmo).toBeNull();
  });
});
