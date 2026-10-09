/** Precio de venta del dólar en un lugar (banco, casa de cambio o app), tal como lo informa CriptoYa. */
export interface Cotizacion {
  nombre: string;
  tipo: 'oficial' | 'banco' | 'app';
  precio: number;
}

/** Un precio de CriptoYa: `totalAsk` es lo que cuesta comprar, con comisiones; `time` en segundos. */
export interface PrecioCriptoYa {
  totalAsk?: number;
  time?: number;
}
export type PreciosPorLugar = Record<string, PrecioCriptoYa>;

export interface FuentesCotizacion {
  /** Respuesta de /api/dolar (solo se usa el oficial). */
  dolar: { oficial?: { ask?: number } };
  usdt: PreciosPorLugar;
  usdc: PreciosPorLugar;
  bancos: PreciosPorLugar;
}

const NOMBRES: Record<string, string> = {
  lemoncash: 'Lemon', lemoncashp2p: 'Lemon P2P', belo: 'Belo', buenbit: 'Buenbit', ripio: 'Ripio',
  ripioexchange: 'Ripio Exchange', satoshitango: 'SatoshiTango', binance: 'Binance', binancep2p: 'Binance P2P',
  bybit: 'Bybit', bybitp2p: 'Bybit P2P', letsbit: 'Letsbit', decrypto: 'Decrypto', fiwind: 'Fiwind',
  tiendacrypto: 'TiendaCrypto', vitawallet: 'Vita Wallet', wallbit: 'Wallbit', takenos: 'Takenos',
  cocoscrypto: 'Cocos Crypto', bitsoalpha: 'Bitso', astropay: 'AstroPay', dolarapp: 'DolarApp', prex: 'Prex',
  bna: 'Banco Nación', bbva: 'BBVA', galicia: 'Galicia', santander: 'Santander', macro: 'Macro',
  supervielle: 'Supervielle', brubank: 'Brubank', hipotecario: 'Hipotecario', icbc: 'ICBC', comafi: 'Comafi',
  mariva: 'Mariva', ciudad: 'Banco Ciudad', patagonia: 'Patagonia',
};
const nombreDe = (clave: string) => NOMBRES[clave] ?? clave.charAt(0).toUpperCase() + clave.slice(1);

/** Los precios que no se actualizan hace más de 3 días se descartan. */
export const VIGENCIA_SEGUNDOS = 3 * 86400;

/**
 * Las opciones más baratas para comprar dólares: oficial, bancos y casas de cambio, y apps (USDT/USDC).
 * Un precio por lugar (el más barato entre las fuentes que lo ofrecen). `ahora` en segundos.
 */
export function mejoresCotizaciones(f: FuentesCotizacion, ahora: number, cantidad = 10): Cotizacion[] {
  const porLugar = new Map<string, Cotizacion>();
  const poner = (id: string, c: Cotizacion) => {
    const actual = porLugar.get(id);
    if (!actual || c.precio < actual.precio) porLugar.set(id, c);
  };
  const vigente = (p: PrecioCriptoYa) => (p.totalAsk ?? 0) > 0 && ahora - (p.time ?? 0) < VIGENCIA_SEGUNDOS;

  const oficial = f.dolar.oficial?.ask ?? 0;
  if (oficial > 0) poner('oficial', { nombre: 'Dólar oficial', tipo: 'oficial', precio: oficial });
  for (const [k, p] of Object.entries(f.bancos)) if (vigente(p)) poner('b' + k, { nombre: nombreDe(k), tipo: 'banco', precio: p.totalAsk! });
  for (const origen of [f.usdt, f.usdc]) {
    for (const [k, p] of Object.entries(origen)) if (vigente(p)) poner('a' + k, { nombre: nombreDe(k), tipo: 'app', precio: p.totalAsk! });
  }
  return [...porLugar.values()].sort((a, b) => a.precio - b.precio).slice(0, cantidad);
}
