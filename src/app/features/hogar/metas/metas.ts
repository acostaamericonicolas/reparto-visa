import { Component, computed, inject } from '@angular/core';
import { MetaAhorro } from '../../../models/hogar';
import { DolaresPipe } from '../../../pipes/dolares-pipe';
import { Hogar, nuevoId } from '../../../services/hogar';
import { montoIngresado } from '../../../shared/montos';
import { progresoAhorro } from '../../../shared/metas';

/** Metas de ahorro en dólares (por ejemplo, la casa propia) y cómo viene cada una. */
@Component({
  selector: 'app-metas-hogar',
  imports: [DolaresPipe],
  templateUrl: './metas.html',
  styleUrl: './metas.css',
})
export class MetasHogar {
  protected hogar = inject(Hogar);

  protected resumen = computed(() => progresoAhorro(this.hogar.config(), this.hogar.meses(), new Date().toISOString().slice(0, 7)));
  protected sinObjetivos = computed(() => this.hogar.config().metas.every((m) => !(m.objetivoUsd > 0)));

  private cambiarMeta(id: string, cambio: (m: MetaAhorro) => void) {
    const c = this.hogar.config();
    const metas = c.metas.map((m) => {
      if (m.id !== id) return m;
      const copia = { ...m };
      cambio(copia);
      return copia;
    });
    this.hogar.guardarConfig({ ...c, metas });
  }

  protected nombre(id: string, e: Event) {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v) this.cambiarMeta(id, (m) => (m.nombre = v));
  }
  protected objetivo(id: string, e: Event) {
    const v = montoIngresado((e.target as HTMLInputElement).value);
    this.cambiarMeta(id, (m) => (m.objetivoUsd = v));
  }
  protected hasta(id: string, e: Event) {
    const v = (e.target as HTMLInputElement).value;
    this.cambiarMeta(id, (m) => (m.hasta = v));
  }
  protected agregar() {
    const c = this.hogar.config();
    this.hogar.guardarConfig({ ...c, metas: [...c.metas, { id: nuevoId(), nombre: 'Nueva meta', objetivoUsd: 0, hasta: '' }] });
  }
  protected quitar(id: string) {
    const c = this.hogar.config();
    this.hogar.guardarConfig({ ...c, metas: c.metas.filter((m) => m.id !== id) });
  }
  /** Una meta pasa a ser más prioritaria: se llena antes. */
  protected subir(i: number) {
    const c = this.hogar.config();
    if (i <= 0) return;
    const metas = [...c.metas];
    [metas[i - 1], metas[i]] = [metas[i], metas[i - 1]];
    this.hogar.guardarConfig({ ...c, metas });
  }
  protected ahorroInicial(e: Event) {
    const v = montoIngresado((e.target as HTMLInputElement).value);
    this.hogar.guardarConfig({ ...this.hogar.config(), ahorroInicialUsd: v });
  }
}
