import { Pipe, PipeTransform } from '@angular/core';

const FORMATO = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/**
 * Variación porcentual: 0.123 → "▲ 12 %", -0.05 → "▼ 5 %", null → "—".
 * Uso: {{ cambio | variacion }}
 */
@Pipe({ name: 'variacion' })
export class VariacionPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '—';
    if (Math.abs(valor) < 0.005) return '= 0 %';
    return `${valor > 0 ? '▲' : '▼'} ${FORMATO.format(Math.abs(valor) * 100)} %`;
  }
}
