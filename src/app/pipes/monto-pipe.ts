import { Pipe, PipeTransform } from '@angular/core';
import { formatoMonto } from '../shared/montos';

/**
 * Monto sin símbolo, para columnas que ya dicen la moneda: 1234.5 → "1.234,50".
 * Uso: {{ item.pesos | monto }}
 */
@Pipe({ name: 'monto' })
export class MontoPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor === null || valor === undefined ? '' : formatoMonto(valor);
  }
}
