import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Quien, RespaldoHogar } from '../../../models/hogar';
import { Datos } from '../../../services/datos';
import { Hogar } from '../../../services/hogar';
import { mensajeDeError } from '../../../shared/errores';
import { nombreMes } from '../../../shared/fechas';

/** Quién es cada uno entre las personas de la tarjeta, categorías, respaldo y borrado de un mes. */
@Component({
  selector: 'app-ajustes-hogar',
  templateUrl: './ajustes.html',
  styleUrl: './ajustes.css',
})
export class AjustesHogar {
  /** Mes que se está viendo ("2026-10"), por si se lo quiere borrar. */
  mes = input<string | null>(null);
  borrado = output<void>();

  protected hogar = inject(Hogar);
  protected datos = inject(Datos);

  protected readonly quienes: Quien[] = ['nico', 'nanu'];
  protected mensaje = signal('');
  protected error = signal('');
  protected confirmando = signal(false);

  protected categorias = computed(() => this.hogar.config().categorias.join(', '));
  protected nombreMes = computed(() => (this.mes() ? nombreMes(this.mes() + '-01') : ''));
  protected existe = computed(() => !!this.mes() && !!this.hogar.meses()[this.mes()!]);

  /** Lo elegido en Ajustes, o lo que se dedujo por nombre, para que el selector muestre lo que realmente se usa. */
  protected elegida(q: Quien): string {
    return this.hogar.personas()?.[q].id ?? this.hogar.config().personas[q];
  }

  private limpiar() {
    this.mensaje.set('');
    this.error.set('');
  }

  protected elegirPersona(q: Quien, e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    const c = this.hogar.config();
    this.hogar.guardarConfig({ ...c, personas: { ...c.personas, [q]: id } });
  }

  protected guardarCategorias(e: Event) {
    const lista = (e.target as HTMLInputElement).value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const c = this.hogar.config();
    this.hogar.guardarConfig({ ...c, categorias: lista.length ? [...new Set(lista)] : c.categorias });
  }

  protected descargarRespaldo() {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([JSON.stringify(this.hogar.respaldo(), null, 1)], { type: 'application/json' }));
    enlace.download = `hogar-${new Date().toISOString().slice(0, 10)}.json`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  }

  protected async restaurar(e: Event) {
    const campo = e.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    this.limpiar();
    try {
      const n = await this.hogar.restaurar(JSON.parse(await archivo.text()) as Partial<RespaldoHogar>);
      this.mensaje.set(`Respaldo restaurado: ${n} mes${n === 1 ? '' : 'es'}.`);
    } catch (err) {
      this.error.set(mensajeDeError(err, 'No se pudo restaurar el respaldo.'));
    }
  }

  protected async borrar() {
    const id = this.mes();
    if (!id) return;
    if (!this.confirmando()) {
      this.confirmando.set(true);
      return;
    }
    this.confirmando.set(false);
    this.limpiar();
    await this.hogar.eliminarMes(id);
    this.mensaje.set(`${this.nombreMes()} borrado.`);
    this.borrado.emit();
  }
}
