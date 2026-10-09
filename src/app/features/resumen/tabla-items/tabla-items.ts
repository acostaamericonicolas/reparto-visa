import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Persona } from '../../../models/config';
import { Item, Parte, Resumen } from '../../../models/resumen';
import { MontoPipe } from '../../../pipes/monto-pipe';
import { Datos } from '../../../services/datos';
import { colorPersona } from '../../../shared/colores';
import { montoIngresado, r2 } from '../../../shared/montos';
import {
  ajustarParte,
  asignarA,
  diferencia,
  dividir,
  moneda,
  pendiente,
  quitarParte,
} from '../../../shared/reparto';

interface Grupo {
  tarjeta: string;
  items: Item[];
}

/** Tabla del resumen agrupada por tarjeta. Cada ítem se asigna a una persona o se divide en partes. */
@Component({
  selector: 'app-tabla-items',
  imports: [MontoPipe],
  templateUrl: './tabla-items.html',
  styleUrl: './tabla-items.css',
})
export class TablaItems {
  private datos = inject(Datos);

  resumen = input.required<Resumen>();
  personas = input.required<Persona[]>();
  /** 'todos', '' (sin asignar) o el id de una persona. */
  filtro = input.required<string>();
  verImpuestos = output<Item>();

  /** Ítems con el editor de partes abierto aunque todavía tengan una sola. */
  private abiertos = signal(new Set<string>());

  protected personaFiltrada = computed(() => this.personas().find((p) => p.id === this.filtro()));

  protected grupos = computed<Grupo[]>(() => {
    const f = this.filtro();
    const grupos: Grupo[] = [];
    for (const r of this.resumen().rows) {
      const visible = f === 'todos' || (f === '' ? pendiente(r) : r.partes.some((p) => p.p === f));
      if (!visible) continue;
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.tarjeta === r.tarjeta) ultimo.items.push(r);
      else grupos.push({ tarjeta: r.tarjeta, items: [r] });
    }
    return grupos;
  });

  protected readonly pendiente = pendiente;
  protected readonly moneda = moneda;
  protected readonly diferencia = diferencia;

  protected color(id: string) {
    return colorPersona(this.personas(), id);
  }

  protected dividido(r: Item) {
    return r.partes.length > 1 || this.abiertos().has(r.id);
  }

  protected dueno(r: Item) {
    return r.partes.length === 1 ? r.partes[0].p : '';
  }

  /** Con una persona filtrada, el monto que le toca a ella en un ítem dividido. */
  protected parteDe(r: Item, m: 'pesos' | 'usd') {
    return r2(r.partes.filter((p) => p.p === this.filtro()).reduce((s, p) => s + (p[m] || 0), 0));
  }

  private guardar(r: Item, partes: Parte[]) {
    this.datos.cambiarPartes(this.resumen().meta.id, r.id, partes);
  }

  protected asignar(r: Item, evento: Event) {
    this.guardar(r, asignarA(r, (evento.target as HTMLSelectElement).value));
  }

  protected alternarDivision(r: Item) {
    const abiertos = new Set(this.abiertos());
    if (this.dividido(r)) {
      abiertos.delete(r.id);
      this.guardar(r, asignarA(r, r.partes.find((p) => p.p)?.p ?? ''));
    } else {
      abiertos.add(r.id);
      this.guardar(r, dividir(r, 2));
    }
    this.abiertos.set(abiertos);
  }

  protected cambiarPersona(r: Item, i: number, evento: Event) {
    const partes = r.partes.map((p) => ({ ...p }));
    partes[i].p = (evento.target as HTMLSelectElement).value;
    this.guardar(r, partes);
  }

  protected cambiarMonto(r: Item, i: number, evento: Event) {
    this.guardar(r, ajustarParte(r, i, montoIngresado((evento.target as HTMLInputElement).value)));
  }

  protected agregarParte(r: Item) {
    this.guardar(r, dividir({ ...r, partes: [...r.partes, { p: '', pesos: 0, usd: 0 }] }, r.partes.length + 1));
  }

  protected partesIguales(r: Item) {
    this.guardar(r, dividir(r, r.partes.length));
  }

  protected quitar(r: Item, i: number) {
    const partes = quitarParte(r, i);
    if (partes.length <= 1) {
      const abiertos = new Set(this.abiertos());
      abiertos.delete(r.id);
      this.abiertos.set(abiertos);
    }
    this.guardar(r, partes);
  }
}
