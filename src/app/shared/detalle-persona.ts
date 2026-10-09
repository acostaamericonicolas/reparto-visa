import { Persona } from '../models/config';
import { Resumen } from '../models/resumen';
import { diaMesAntes, fechaIso } from './fechas';
import { formatoMonto, r2 } from './montos';

/** Días antes del vencimiento de la tarjeta que se le pide a cada persona que pague. */
export const DIAS_ANTES_DEL_VENCIMIENTO = 2;

/**
 * Texto con los ítems y el total de una persona, para mandar por WhatsApp.
 * Al final: hasta cuándo pagar (vencimiento menos 2 días) y el alias, si está cargado.
 */
export function detalleDePersona(res: Resumen, persona: Persona, alias = ''): string {
  const lineas = [`Resumen Visa · cierre ${res.meta.cierre} · ${persona.nombre}`, ''];
  let pesos = 0;
  let usd = 0;
  for (const r of res.rows) {
    for (const p of r.partes) {
      if (p.p !== persona.id) continue;
      pesos = r2(pesos + (p.pesos || 0));
      usd = r2(usd + (p.usd || 0));
      const monto = p.usd && !p.pesos ? `U$S ${formatoMonto(p.usd)}` : `$ ${formatoMonto(p.pesos)}`;
      const cuota = r.cuota ? ` · cuota ${r.cuota}` : '';
      const parte = r.partes.length > 1 ? ' (parte)' : '';
      lineas.push(`${r.fecha}  ${r.detalle}${cuota}${parte}  ${monto}`);
    }
  }
  lineas.push('', `Total: $ ${formatoMonto(pesos)}${usd ? ` + U$S ${formatoMonto(usd)}` : ''}`);

  const vence = fechaIso(res.meta.vence);
  const pie = [
    vence ? `Vence el ${diaMesAntes(vence, DIAS_ANTES_DEL_VENCIMIENTO)}` : '',
    alias.trim() ? `Alias: ${alias.trim()}` : '',
  ].filter(Boolean);
  if (pie.length) lineas.push('', ...pie);
  return lineas.join('\n');
}
