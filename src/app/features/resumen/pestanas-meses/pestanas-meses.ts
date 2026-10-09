import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Resumen } from '../../../models/resumen';
import { fechaIso, nombreMes } from '../../../shared/fechas';
import { pendiente } from '../../../shared/reparto';

/** Una pestaña por resumen, nombrada por el mes en que vence, con lo que falta asignar. */
@Component({
  selector: 'app-pestanas-meses',
  imports: [RouterLink],
  templateUrl: './pestanas-meses.html',
  styleUrl: './pestanas-meses.css',
})
export class PestanasMeses {
  resumenes = input.required<Resumen[]>();
  actual = input<string | null>(null);

  protected pestanas = computed(() =>
    this.resumenes().map((r) => ({
      id: r.meta.id,
      nombre: nombreMes(fechaIso(r.meta.vence) ?? r.meta.id),
      pendientes: r.rows.filter(pendiente).length,
    })),
  );
}
