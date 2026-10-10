import { Component, computed, inject, signal } from '@angular/core';
import { PesosPipe } from '../../pipes/pesos-pipe';
import { DolaresPipe } from '../../pipes/dolares-pipe';
import { VariacionPipe } from '../../pipes/variacion-pipe';
import { Datos } from '../../services/datos';
import { colorPersona } from '../../shared/colores';
import { Grafico, SerieGrafico } from '../../shared/componentes/grafico/grafico';
import { fechaIso, nombreMes } from '../../shared/fechas';
import { Serie, cuotasPendientes, gastoPorMes, proyeccionCuotas, variacion } from '../../shared/estadisticas';
import { r2 } from '../../shared/montos';

type Moneda = 'pesos' | 'usd';

@Component({
  selector: 'app-graficos',
  imports: [Grafico, PesosPipe, DolaresPipe, VariacionPipe],
  templateUrl: './graficos.html',
  styleUrl: './graficos.css',
})
export class Graficos {
  protected datos = inject(Datos);

  protected moneda = signal<Moneda>('pesos');
  /** Persona elegida en la evolución (null = todas; '' = la parte sin asignar). */
  protected personaEvolucion = signal<string | null>(null);
  /** Mes desde el que se proyectan las cuotas (por defecto, el último). */
  private mesProyeccionElegido = signal<string | null>(null);

  private resumenes = computed(() => this.datos.ids().map((id) => this.datos.resumenes()[id]));
  protected gasto = computed(() => gastoPorMes(this.resumenes(), this.datos.personas()));

  private color = (s: Serie) => colorPersona(this.datos.personas(), s.id);

  protected seriesMoneda = computed(() => (this.moneda() === 'pesos' ? this.gasto().pesos : this.gasto().usd));
  protected totalMoneda = computed(() => (this.moneda() === 'pesos' ? this.gasto().totalPesos : this.gasto().totalUsd));
  protected prefijo = computed(() => (this.moneda() === 'pesos' ? '$ ' : 'U$S '));

  /** Filas de la tabla: cada persona con su gasto por mes y la variación del último mes. */
  protected filas = computed(() =>
    this.seriesMoneda().map((s) => ({
      ...s,
      color: this.color(s),
      variacion: variacion(s.datos.at(-1) ?? 0, s.datos.at(-2)),
    })),
  );
  protected variacionTotal = computed(() => variacion(this.totalMoneda().at(-1) ?? 0, this.totalMoneda().at(-2)));

  protected seriesEvolucion = computed<SerieGrafico[]>(() =>
    this.seriesMoneda()
      .filter((s) => this.personaEvolucion() === null || s.id === this.personaEvolucion())
      .map((s) => ({ nombre: s.nombre, datos: s.datos, color: this.color(s) })),
  );

  protected mesProyeccion = computed(() => {
    const elegido = this.mesProyeccionElegido();
    return elegido && this.datos.resumenes()[elegido] ? elegido : (this.datos.ids().at(-1) ?? null);
  });
  protected opcionesProyeccion = computed(() =>
    this.datos.ids().map((id) => ({ id, nombre: nombreMes(fechaIso(this.datos.resumenes()[id].meta.vence) ?? id) })),
  );
  protected proyeccion = computed(() => {
    const id = this.mesProyeccion();
    return id ? proyeccionCuotas(this.datos.resumenes()[id], this.datos.personas()) : null;
  });
  /** Persona elegida en la proyección (null = todas; '' = la parte sin asignar). */
  protected personaProyeccion = signal<string | null>(null);

  protected seriesProyeccion = computed<SerieGrafico[]>(() => {
    const p = this.proyeccion();
    if (!p) return [];
    const elegida = this.personaProyeccion();
    const series: SerieGrafico[] = p.series
      .filter((s) => elegida === null || s.id === elegida)
      .map((s) => ({ nombre: s.nombre, datos: s.datos, color: this.color(s) }));
    // Lo del banco es el total de la tarjeta: solo se compara cuando se ven todas las personas.
    if (elegida === null && p.banco.some((v) => v !== null)) {
      series.push({ nombre: 'Cuotas a vencer según el banco', datos: p.banco, color: 'var(--texto-2)', linea: true, punteada: true });
    }
    return series;
  });
  /** Lo que le queda pagar en cuotas a cada persona, sumando todos los meses proyectados. */
  protected comprometido = computed(() =>
    (this.proyeccion()?.series ?? [])
      .map((s) => ({ ...s, color: this.color(s), total: r2(s.datos.reduce((a, b) => a + b, 0)) }))
      .sort((a, b) => b.total - a.total),
  );

  protected totalComprometido = computed(() => r2(this.comprometido().reduce((s, c) => s + c.total, 0)));

  /** Detalle de las cuotas de la persona elegida en la proyección. */
  protected cuotasDeLaPersona = computed(() => {
    const id = this.mesProyeccion();
    const elegida = this.personaProyeccion();
    return id && elegida !== null ? cuotasPendientes(this.datos.resumenes()[id], elegida) : [];
  });
  protected nombreElegido = computed(() => this.comprometido().find((c) => c.id === this.personaProyeccion())?.nombre ?? '');

  protected alternarPersonaProyeccion(id: string | null) {
    this.personaProyeccion.set(this.personaProyeccion() === id ? null : id);
  }

  /** Chips de la evolución: cada persona (y "Sin asignar") con su color. */
  protected chipsEvolucion = computed(() => this.seriesMoneda().map((s) => ({ id: s.id, nombre: s.nombre, color: this.color(s) })));

  /** Tocar una persona la muestra sola; tocarla de nuevo (o "Todas") vuelve a mostrar todas. */
  protected alternarPersonaEvolucion(id: string | null) {
    this.personaEvolucion.set(id === null || this.personaEvolucion() === id ? null : id);
  }

  /** Lo que queda en cuotas: de todas las personas o de la elegida. */
  protected montoProyeccion = computed(() => {
    const elegida = this.personaProyeccion();
    return elegida === null ? this.totalComprometido() : (this.comprometido().find((c) => c.id === elegida)?.total ?? 0);
  });

  /** Último mes con cuotas y lo que vence el mes que viene, para la tarjeta de la proyección. */
  protected hasta = computed(() => this.proyeccion()?.etiquetas.at(-1) ?? '');
  protected proximoMes = computed(() => {
    const p = this.proyeccion();
    const elegida = this.personaProyeccion();
    if (!p) return 0;
    return elegida === null ? (p.total[0] ?? 0) : (p.series.find((s) => s.id === elegida)?.datos[0] ?? 0);
  });

  protected elegirMesProyeccion(evento: Event) {
    this.mesProyeccionElegido.set((evento.target as HTMLSelectElement).value);
  }
}
