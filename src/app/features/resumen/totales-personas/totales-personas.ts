import { Component, computed, input, model, output } from '@angular/core';
import { Persona } from '../../../models/config';
import { EstadoPersona, Resumen } from '../../../models/resumen';
import { DolaresPipe } from '../../../pipes/dolares-pipe';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { colorPersona } from '../../../shared/colores';
import { totalesPorPersona } from '../../../shared/reparto';

/** Tarjetas con el total de cada persona. Tocar una filtra la tabla. */
@Component({
  selector: 'app-totales-personas',
  imports: [PesosPipe, DolaresPipe],
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

  protected estado(id: string): EstadoPersona {
    return this.resumen().estados?.[id] ?? { avisado: false, pagado: false };
  }

  protected marcar(persona: string, campo: keyof EstadoPersona, evento: Event) {
    this.cambiarEstado.emit({ persona, campo, valor: (evento.target as HTMLInputElement).checked });
  }

  protected totales = computed(() => totalesPorPersona(this.resumen(), this.personas()));
  protected sinAsignar = computed(() => this.totales().get('')!);

  protected color(id: string) {
    return colorPersona(this.personas(), id);
  }

  protected alternar(id: string) {
    this.filtro.set(this.filtro() === id ? 'todos' : id);
  }
}
