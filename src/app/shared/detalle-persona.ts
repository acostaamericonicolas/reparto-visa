import { Persona } from '../models/config';
import { Resumen } from '../models/resumen';
import { formatoMonto, r2 } from './montos';

/** Texto con los ítems y el total de una persona, para mandar por WhatsApp. */
export function detalleDePersona(res: Resumen, persona: Persona): string {
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
  return lineas.join('\n');
}
