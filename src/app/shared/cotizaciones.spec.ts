import { describe, expect, it } from 'vitest';
import { FuentesCotizacion, mejoresCotizaciones } from './cotizaciones';

const AHORA = 1_000_000;
const precio = (totalAsk: number, hace = 60) => ({ totalAsk, time: AHORA - hace });

const fuentes = (extra: Partial<FuentesCotizacion> = {}): FuentesCotizacion => ({
  dolar: { oficial: { ask: 1540 } },
  usdt: {},
  usdc: {},
  bancos: {},
  ...extra,
});

describe('mejoresCotizaciones', () => {
  it('ordena de la más barata a la más cara', () => {
    const r = mejoresCotizaciones(
      fuentes({ bancos: { prex: precio(1530), bna: precio(1545) }, usdt: { belo: precio(1520) } }),
      AHORA,
    );
    expect(r.map((c) => [c.nombre, c.precio])).toEqual([['Belo', 1520], ['Prex', 1530], ['Dólar oficial', 1540], ['Banco Nación', 1545]]);
  });

  it('descarta los precios sin actualizar hace más de 3 días y los sin precio', () => {
    const r = mejoresCotizaciones(
      fuentes({ bancos: { galicia: precio(1470, 5 * 86400), prex: precio(1530), roto: { time: AHORA } } }),
      AHORA,
    );
    expect(r.map((c) => c.nombre)).toEqual(['Prex', 'Dólar oficial']);
  });

  it('deja un solo precio por lugar: el más barato entre USDT y USDC', () => {
    const r = mejoresCotizaciones(fuentes({ usdt: { lemoncash: precio(1600) }, usdc: { lemoncash: precio(1590) } }), AHORA);
    expect(r.filter((c) => c.nombre === 'Lemon')).toEqual([{ nombre: 'Lemon', tipo: 'app', precio: 1590 }]);
  });

  it('devuelve solo la cantidad pedida', () => {
    const bancos = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['b' + i, precio(1500 + i)]));
    expect(mejoresCotizaciones(fuentes({ bancos }), AHORA, 5)).toHaveLength(5);
  });
});
