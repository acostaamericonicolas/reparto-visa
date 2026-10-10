import { Component, computed, input, model, output } from '@angular/core';
import { Persona } from '../../../models/config';
import { EstadoPersona, Resumen } from '../../../models/resumen';
import { DolaresPipe } from '../../../pipes/dolares-pipe';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { colorPersona } from '../../../shared/colores';
import { Icono } from '../../../shared/componentes/icono/icono';
import { ordenarPersonas, totalesPorPersona } from '../../../shared/reparto';

/** Una tarjeta por persona, ordenadas por monto: nombre y saldo arriba; Avisado, Pagó y Copiar abajo. Tocar la tarjeta filtra Movimientos. */
@Component({
  selector: 'app-totales-personas',
  imports: [PesosPipe, DolaresPipe, Icono],
  templateUrl: './totales-personas.html',
  styleUrl: './totales-personas.css',
})
export class TotalesPersonas {
  resumen = input.required<Resumen>();
  personas = input.required<Persona[]>();
  /** 'todos', '' (sin asignar) o el id de una persona. */
  filtro = model.required<string>();
  copiar = output<Persona>();
  cambiarEstado = output<{ persona: string; campo: keyof EstadoPersona; valor: boolean }>();

  protected totales = computed(() => totalesPorPersona(this.resumen(), this.personas()));
  /** Las que deben primero (de mayor a menor), las que pagaron al final. */
  protected ordenadas = computed(() => ordenarPersonas(this.personas(), this.totales(), this.resumen().estados));

  protected color(id: string) {
    return colorPersona(this.personas(), id);
  }

  protected estado(id: string): EstadoPersona {
    return this.resumen().estados?.[id] ?? { avisado: false, pagado: false };
  }

  protected marcar(persona: string, campo: keyof EstadoPersona, valor: boolean) {
    this.cambiarEstado.emit({ persona, campo, valor });
  }

  protected alternar(id: string) {
    this.filtro.set(this.filtro() === id ? 'todos' : id);
  }
}
