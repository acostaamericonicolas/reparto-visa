import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Persona } from '../../models/config';
import { Item } from '../../models/resumen';
import { PesosPipe } from '../../pipes/pesos-pipe';
import { DolaresPipe } from '../../pipes/dolares-pipe';
import { Datos } from '../../services/datos';
import { detalleDePersona } from '../../shared/detalle-persona';
import { DetalleImpuestos } from './detalle-impuestos/detalle-impuestos';
import { PestanasMeses } from './pestanas-meses/pestanas-meses';
import { TablaItems } from './tabla-items/tabla-items';
import { TotalesPersonas } from './totales-personas/totales-personas';

interface Estado {
  texto: string;
  tipo: '' | 'advertencia' | 'error';
  avisos?: string[];
}

@Component({
  selector: 'app-resumen',
  imports: [PestanasMeses, TotalesPersonas, TablaItems, DetalleImpuestos, PesosPipe, DolaresPipe],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class Resumen {
  protected datos = inject(Datos);
  private router = inject(Router);

  /** Fecha de cierre del mes elegido (?mes= en la URL). Sin mes, se muestra el último. */
  mes = input<string>();

  protected mesId = computed(() => {
    const id = this.mes();
    return id && this.datos.resumenes()[id] ? id : (this.datos.ids().at(-1) ?? null);
  });
  protected resumen = computed(() => (this.mesId() ? this.datos.resumenes()[this.mesId()!] : null));
  protected lista = computed(() => this.datos.ids().map((id) => this.datos.resumenes()[id]));

  /** El filtro vale para el mes en que se eligió; al cambiar de mes vuelve a "todos". */
  private filtroElegido = signal({ mes: '' as string | null, valor: 'todos' });
  protected filtro = computed(() => (this.filtroElegido().mes === this.mesId() ? this.filtroElegido().valor : 'todos'));

  protected importando = signal(false);
  protected estado = signal<Estado | null>(null);
  protected impuestos = signal<Item | null>(null);
  protected copia = signal<{ titulo: string; texto: string } | null>(null);

  protected cambiarFiltro(valor: string, mes = this.mesId()) {
    this.filtroElegido.set({ mes, valor });
  }

  protected async importar(evento: Event) {
    const campo = evento.target as HTMLInputElement;
    const archivo = campo.files?.[0];
    campo.value = '';
    if (!archivo) return;
    this.importando.set(true);
    this.estado.set({ texto: 'Leyendo el PDF…', tipo: '' });
    try {
      const r = await this.datos.importar(archivo);
      await this.router.navigate(['/'], { queryParams: { mes: r.resumen.meta.id } });
      // Si quedó algo por asignar, se abre directo en "Sin asignar".
      this.cambiarFiltro(r.pendientes ? '' : 'todos', r.resumen.meta.id);
      this.estado.set({
        texto:
          `Importado el cierre ${r.resumen.meta.cierre}: ${r.resumen.rows.length} ítems. ` +
          `${r.completados} se completaron con el reparto de otros meses; ${r.pendientes} quedan por asignar.`,
        tipo: r.avisos.length ? 'advertencia' : '',
        avisos: r.avisos,
      });
    } catch (e) {
      this.estado.set({ texto: (e as Error).message || 'No se pudo leer el PDF.', tipo: 'error' });
    } finally {
      this.importando.set(false);
    }
  }

  protected completar() {
    const id = this.mesId();
    if (!id) return;
    const n = this.datos.completar(id);
    this.estado.set({
      texto: n ? `Se completaron ${n} ítems con el reparto de otros meses.` : 'No hay ítems sin asignar que aparezcan en otros meses.',
      tipo: '',
    });
  }

  protected async copiar(persona: Persona) {
    const res = this.resumen();
    if (!res) return;
    const texto = detalleDePersona(res, persona);
    // Copiar el detalle es para mandárselo: queda marcado "A" (avisado). Se puede desmarcar a mano.
    if (!res.estados?.[persona.id]?.avisado) this.datos.cambiarEstado(res.meta.id, persona.id, 'avisado', true);
    try {
      await navigator.clipboard.writeText(texto);
      this.estado.set({ texto: `Detalle de ${persona.nombre} copiado.`, tipo: '' });
    } catch {
      // Sin permiso de portapapeles: se muestra el texto para copiarlo a mano.
      this.copia.set({ titulo: `Detalle de ${persona.nombre}`, texto });
    }
  }
}
