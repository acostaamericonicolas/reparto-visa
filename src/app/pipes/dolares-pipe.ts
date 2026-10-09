import { Pipe, PipeTransform } from '@angular/core';
import { formatoMonto } from '../shared/montos';

/**
 * Montos en dólares: 1.99 → "U$S 1,99".
 * Uso: {{ total | dolares }}
 */
@Pipe({ name: 'dolares' })
export class DolaresPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor === null || valor === undefined ? '' : 'U$S ' + formatoMonto(valor);
  }
}
