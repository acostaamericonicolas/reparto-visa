import { Component, input, output } from '@angular/core';
import { Item } from '../../../models/resumen';
import { DolaresPipe } from '../../../pipes/dolares-pipe';
import { PesosPipe } from '../../../pipes/pesos-pipe';

/** Ventana con el desglose del ítem unificado de impuestos y cargos. */
@Component({
  selector: 'app-detalle-impuestos',
  imports: [PesosPipe, DolaresPipe],
  templateUrl: './detalle-impuestos.html',
  styleUrl: './detalle-impuestos.css',
  host: { '(document:keydown.escape)': 'cerrar.emit()' },
})
export class DetalleImpuestos {
  item = input.required<Item>();
  cerrar = output<void>();
}
