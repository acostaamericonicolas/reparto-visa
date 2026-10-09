import { Pipe, PipeTransform } from '@angular/core';
import { formatoMonto } from '../shared/montos';

/**
 * Montos en pesos: 1234.5 → "$ 1.234,50".
 * Uso: {{ total | pesos }}
 */
@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor === null || valor === undefined ? '' : '$ ' + formatoMonto(valor);
  }
}
