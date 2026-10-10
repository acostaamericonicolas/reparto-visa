import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { Persona } from '../../models/config';
import { Item } from '../../models/resumen';
import { PesosPipe } from '../../pipes/pesos-pipe';
import { DolaresPipe } from '../../pipes/dolares-pipe';
import { Datos } from '../../services/datos';
import { detalleDePersona } from '../../shared/detalle-persona';
import { fechaIso, mesCorto, mesesFuturos, nombreMes } from '../../shared/fechas';
import { TotalPersona, pendiente, totalesPorPersona } from '../../shared/reparto';
import { Icono } from '../../shared/componentes/icono/icono';
import { OpcionMes, SelectorMeses } from '../../shared/componentes/selector-meses/selector-meses';
import { DetalleImpuestos } from './detalle-impuestos/detalle-impuestos';
import { TablaItems } from './tabla-items/tabla-items';
import { TotalesPersonas } from './totales-personas/totales-personas';

interface Estado {
  texto: string;
  tipo: '' | 'advertencia' | 'error';
  avisos?: string[];
}

@Component({
  selector: 'app-resumen',
  imports: [SelectorMeses, TotalesPersonas, TablaItems, DetalleImpuestos, PesosPipe, DolaresPipe, FormField, Icono],
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
    return id && (this.datos.resumenes()[id] || this.futuros().includes(id)) ? id : (this.datos.ids().at(-1) ?? null);
  });
  protected resumen = computed(() => (this.mesId() ? this.datos.resumenes()[this.mesId()!] : null));
  protected lista = computed(() => this.datos.ids().map((id) => this.datos.resumenes()[id]));

  /** Meses que vienen y todavía no tienen PDF ("yyyy-mm"): se ven apagados hasta importar su resumen. */
  protected futuros = computed(() => {
    const ultimo = this.lista().at(-1);
    if (!ultimo) return [];
    const hoy = new Date();
    const mesHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    return mesesFuturos(mesHoy, (fechaIso(ultimo.meta.vence) ?? ultimo.meta.id).slice(0, 7));
  });
  /** El mes elegido, si es uno que todavía no tiene PDF. */
  protected mesFuturo = computed(() => {
    const id = this.mesId();
    return id && this.futuros().includes(id) ? id : null;
  });

  /** Meses para el selector centrado: el nombre por el mes en que vence y cuántos ítems faltan asignar. */
  protected opcionesMeses = computed<OpcionMes[]>(() =>
    this.lista().map((r): OpcionMes => {
      const vence = fechaIso(r.meta.vence) ?? r.meta.id;
      const pendientes = r.rows.filter(pendiente).length;
      return { id: r.meta.id, largo: nombreMes(vence), corto: mesCorto(vence), detalle: pendientes ? `${pendientes} pend.` : '' };
    }).concat(
      this.futuros().map((mes) => ({ id: mes, largo: nombreMes(mes + '-01'), corto: mesCorto(mes + '-01'), apagado: true })),
    ),
  );

  protected totales = computed(() => {
    const r = this.resumen();
    return r ? totalesPorPersona(r, this.datos.personas()) : new Map<string, TotalPersona>();
  });
  protected sinAsignar = computed(() => this.totales().get('') ?? { pesos: 0, usd: 0, items: 0 });

  /** Cobranza del mes: quiénes tienen algo para pagar, cuántos pagaron y cuánto se cobró. */
  protected cobranza = computed(() => {
    const r = this.resumen();
    const conDeuda = this.datos.personas().filter((p) => {
      const t = this.totales().get(p.id);
      return !!t && (t.pesos > 0 || t.usd > 0);
    });
    const estado = (id: string) => r?.estados?.[id];
    const pagaron = conDeuda.filter((p) => estado(p.id)?.pagado);
    const total = conDeuda.reduce((s, p) => s + (this.totales().get(p.id)?.pesos ?? 0), 0);
    const cobrado = pagaron.reduce((s, p) => s + (this.totales().get(p.id)?.pesos ?? 0), 0);
    return {
      personas: conDeuda.length,
      avisadas: conDeuda.filter((p) => estado(p.id)?.avisado).length,
      pagaron: pagaron.length,
      cobrado,
      porcentaje: total > 0 ? Math.round((cobrado / total) * 100) : 0,
    };
  });

  /** Chip de la tarjeta principal: cuánto falta para el vencimiento (o que ya se cobró todo). */
  protected vencimiento = computed(() => {
    const r = this.resumen();
    const iso = r ? fechaIso(r.meta.vence) : null;
    const c = this.cobranza();
    if (c.personas > 0 && c.pagaron === c.personas) return { texto: 'Todo cobrado', listo: true };
    if (!iso) return null;
    const hoy = new Date();
    const dias = Math.round((Date.parse(iso + 'T00:00:00') - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
    const texto = dias > 1 ? `Vence en ${dias} días` : dias === 1 ? 'Vence mañana' : dias === 0 ? 'Vence hoy' : `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
    return { texto, listo: false };
  });

  protected irAMes(id: string) {
    this.router.navigate(['/'], { queryParams: { mes: id } });
  }

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

  /** "Movimientos" arranca cerrado; se abre al tocarlo o al elegir una persona o "Sin asignar". */
  protected movimientosAbiertos = signal(false);
  private movimientos = viewChild<ElementRef<HTMLDetailsElement>>('movimientos');
  protected nombreFiltro = computed(() => this.datos.persona(this.filtro())?.nombre ?? '');

  /** Tocar una tarjeta filtra la tabla, la abre y la lleva a la vista (en el celular queda más abajo). */
  protected elegirPersona(valor: string) {
    this.cambiarFiltro(valor);
    if (valor === 'todos') return;
    this.abrirMovimientos();
  }

  private abrirMovimientos() {
    this.movimientosAbiertos.set(true);
    setTimeout(() => this.movimientos()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // --- Alias que va al final del detalle de cada persona ---
  protected editandoAlias = signal(false);
  protected nuevoAlias = signal({ alias: '' });
  protected fAlias = form(this.nuevoAlias);

  protected editarAlias() {
    this.nuevoAlias.set({ alias: this.datos.config().alias ?? '' });
    this.editandoAlias.set(true);
  }

  protected guardarAlias(evento: Event) {
    evento.preventDefault();
    const alias = this.nuevoAlias().alias.trim();
    this.datos.guardarConfig({ ...this.datos.config(), alias });
    this.editandoAlias.set(false);
    this.estado.set({ texto: alias ? `Alias guardado: ${alias}.` : 'Alias borrado: el detalle ya no lo incluye.', tipo: '' });
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
      if (r.pendientes) this.abrirMovimientos();
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
    const texto = detalleDePersona(res, persona, this.datos.config().alias);
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
