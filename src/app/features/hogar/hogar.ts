import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Hogar } from '../../services/hogar';
import { nombreMes } from '../../shared/fechas';
import { mesAnterior } from '../../shared/hogar';
import { AjustesHogar } from './ajustes/ajustes';
import { FormularioMes } from './formulario-mes/formulario-mes';
import { HistorialHogar } from './historial/historial';
import { MetasHogar } from './metas/metas';
import { ResultadosMes } from './resultados-mes/resultados-mes';

type Vista = 'mes' | 'historial' | 'metas' | 'ajustes';
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Gastos del hogar: carga del mes, resultados, historial y ajustes. */
@Component({
  selector: 'app-hogar',
  imports: [FormularioMes, ResultadosMes, HistorialHogar, MetasHogar, AjustesHogar],
  templateUrl: './hogar.html',
  styleUrl: './hogar.css',
})
export class HogarPagina {
  protected hogar = inject(Hogar);
  private router = inject(Router);

  /** Mes elegido ("2026-10", viene de ?mes= en la URL). Sin mes, se muestra el último cargado. */
  mes = input<string>();

  protected vista = signal<Vista>('mes');
  protected readonly vistas: { id: Vista; nombre: string }[] = [
    { id: 'mes', nombre: 'Mes' },
    { id: 'historial', nombre: 'Historial' },
    { id: 'metas', nombre: 'Metas' },
    { id: 'ajustes', nombre: 'Ajustes' },
  ];

  protected mesId = computed(() => {
    const m = this.mes();
    return m && MES.test(m) ? m : (this.hogar.ids().at(-1) ?? new Date().toISOString().slice(0, 7));
  });
  protected datosMes = computed(() => this.hogar.meses()[this.mesId()] ?? null);
  protected nombre = computed(() => nombreMes(this.mesId() + '-01'));
  protected anterior = computed(() => mesAnterior(this.hogar.ids(), this.mesId()));
  protected datosAnterior = computed(() => (this.anterior() ? this.hogar.meses()[this.anterior()!] : undefined));
  protected nombreAnterior = computed(() => (this.anterior() ? nombreMes(this.anterior() + '-01') : ''));

  protected elegirMes(e: Event) {
    const valor = (e.target as HTMLInputElement).value;
    if (MES.test(valor)) this.irA(valor);
  }

  protected irA(mes: string | undefined) {
    this.router.navigate(['/hogar'], { queryParams: mes ? { mes } : {} });
  }

  protected crear() {
    this.hogar.crearMes(this.mesId());
  }
}
