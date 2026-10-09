import { Component, computed, inject, input, signal } from '@angular/core';
import { GastoIndividual, MesHogar, Quien } from '../../../models/hogar';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Hogar, nuevoId } from '../../../services/hogar';
import { calcularMes, disponiblePersona } from '../../../shared/hogar';
import { montoIngresado } from '../../../shared/montos';

/**
 * Gastos propios de cada uno (lo que no es compartido ni va en la tarjeta) y cuánta plata le queda del mes:
 * lo libre menos lo que gastó.
 */
@Component({
  selector: 'app-personal-hogar',
  imports: [PesosPipe],
  templateUrl: './personal.html',
  styleUrl: './personal.css',
})
export class PersonalHogar {
  /** Mes en formato "2026-10". */
  id = input.required<string>();
  mes = input.required<MesHogar>();

  protected hogar = inject(Hogar);
  protected readonly quienes: Quien[] = ['nico', 'nanu'];
  protected nombres = this.hogar.nombres;
  protected categorias = computed(() => this.hogar.config().categorias);

  protected quien = signal<Quien>('nico');
  protected disponible = computed(() => disponiblePersona(this.mes(), this.quien()));
  protected gastos = computed(() => this.mes().individuales[this.quien()]);
  /** La tarjeta personal de esta persona: ya está descontada de lo libre. */
  protected tarjeta = computed(() => calcularMes(this.mes())[this.quien()].tarjeta);
  /** Cuánto de lo libre ya se gastó, de 0 a 100 (para la barra). */
  protected usado = computed(() => {
    const d = this.disponible();
    return d.libre > 0 ? Math.min(100, Math.max(0, (d.gastado / d.libre) * 100)) : d.gastado > 0 ? 100 : 0;
  });

  private cambiar(cambio: (lista: GastoIndividual[]) => void) {
    const q = this.quien();
    this.hogar.actualizar(this.id(), (m) => cambio(m.individuales[q]));
  }
  private texto = (e: Event) => (e.target as HTMLInputElement | HTMLSelectElement).value;

  /** Hoy, si es del mes que se está viendo; si no, el primer día de ese mes. */
  private fechaPorDefecto(): string {
    const hoy = new Date().toISOString().slice(0, 10);
    return hoy.startsWith(this.id()) ? hoy : this.id() + '-01';
  }

  protected agregar() {
    const gasto: GastoIndividual = { id: nuevoId(), fecha: this.fechaPorDefecto(), concepto: '', categoria: this.categorias()[0] ?? 'Otros', monto: 0 };
    this.cambiar((l) => l.push(gasto));
  }
  private editar(id: string, cambio: (g: GastoIndividual) => void) {
    this.cambiar((l) => {
      const g = l.find((x) => x.id === id);
      if (g) cambio(g);
    });
  }
  protected fecha(id: string, e: Event) {
    const v = this.texto(e);
    this.editar(id, (g) => (g.fecha = v));
  }
  protected concepto(id: string, e: Event) {
    const v = this.texto(e);
    this.editar(id, (g) => (g.concepto = v));
  }
  protected categoria(id: string, e: Event) {
    const v = this.texto(e);
    this.editar(id, (g) => (g.categoria = v));
  }
  protected monto(id: string, e: Event) {
    const v = montoIngresado(this.texto(e));
    this.editar(id, (g) => (g.monto = v));
  }
  protected quitar(id: string) {
    const q = this.quien();
    this.hogar.actualizar(this.id(), (m) => (m.individuales[q] = m.individuales[q].filter((g) => g.id !== id)));
  }

  /** Categorías para elegir; si el gasto tiene una que ya no está en la lista, se conserva. */
  protected opciones(g: GastoIndividual): string[] {
    return this.categorias().includes(g.categoria) ? this.categorias() : [...this.categorias(), g.categoria];
  }
}
