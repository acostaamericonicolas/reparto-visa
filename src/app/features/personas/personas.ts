import { Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { Respaldo } from '../../models/config';
import { Datos } from '../../services/datos';
import { colorPersona } from '../../shared/colores';
import { mensajeDeError } from '../../shared/errores';
import { TARJETA_IMPUESTOS } from '../../shared/lector-resumen';

@Component({
  selector: 'app-personas',
  imports: [FormField],
  templateUrl: './personas.html',
  styleUrl: './personas.css',
})
export class Personas {
  protected datos = inject(Datos);

  protected mensaje = signal('');
  protected error = signal('');
  /** Persona a la que se le tocó "Eliminar" una vez (el segundo toque confirma). */
  protected confirmando = signal<string | null>(null);

  protected nueva = signal({ nombre: '' });
  protected fNueva = form(this.nueva, (s) => {
    required(s.nombre, { message: 'Escribí un nombre' });
  });

  /** Todas las tarjetas que aparecen en los resúmenes (menos el ítem de impuestos). */
  protected tarjetas = computed(() => {
    const nombres = new Set<string>();
    for (const r of Object.values(this.datos.resumenes())) {
      for (const it of r.rows) if (it.tarjeta !== TARJETA_IMPUESTOS) nombres.add(it.tarjeta);
    }
    return [...nombres].sort();
  });

  protected color(id: string) {
    return colorPersona(this.datos.personas(), id);
  }

  private limpiar() {
    this.mensaje.set('');
    this.error.set('');
  }

  protected agregar(evento: Event) {
    evento.preventDefault();
    if (this.fNueva().invalid()) {
      // Así se muestra el error aunque no se haya tocado el campo.
      this.fNueva.nombre().markAsTouched();
      return;
    }
    this.limpiar();
    const nombre = this.nueva().nombre.trim();
    const c = this.datos.config();
    if (c.personas.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.error.set(`Ya existe una persona llamada ${nombre}.`);
      return;
    }
    this.datos.guardarConfig({ ...c, personas: [...c.personas, { id: 'p-' + Date.now().toString(36), nombre }] });
    this.nueva.set({ nombre: '' });
    this.fNueva().reset();
    this.mensaje.set(`${nombre} agregada.`);
  }

  protected renombrar(id: string, evento: Event) {
    const nombre = (evento.target as HTMLInputElement).value.trim();
    const c = this.datos.config();
    if (!nombre || c.personas.find((p) => p.id === id)?.nombre === nombre) return;
    this.datos.guardarConfig({ ...c, personas: c.personas.map((p) => (p.id === id ? { ...p, nombre } : p)) });
  }

  protected eliminar(id: string) {
    if (this.confirmando() !== id) {
      this.confirmando.set(id);
      return;
    }
    this.confirmando.set(null);
    this.limpiar();
    const nombre = this.datos.persona(id)?.nombre;
    this.datos.eliminarPersona(id);
    this.mensaje.set(`${nombre} eliminada. Sus ítems quedaron sin asignar.`);
  }

  protected duenoTarjeta(tarjeta: string, evento: Event) {
    const persona = (evento.target as HTMLSelectElement).value;
    const c = this.datos.config();
    const tarjetas = { ...c.tarjetas };
    if (persona) tarjetas[tarjeta] = persona;
    else delete tarjetas[tarjeta];
    this.datos.guardarConfig({ ...c, tarjetas });
  }

  protected descargarRespaldo() {
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([JSON.stringify(this.datos.respaldo(), null, 1)], { type: 'application/json' }));
    enlace.download = `reparto-visa-${new Date().toISOString().slice(0, 10)}.json`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  }

  protected async restaurar(evento: Event) {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    this.limpiar();
    try {
      const n = await this.datos.restaurar(JSON.parse(await archivo.text()) as Partial<Respaldo>);
      this.mensaje.set(`Respaldo restaurado: ${n} mes${n === 1 ? '' : 'es'}.`);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo restaurar el respaldo.'));
    }
  }
}
