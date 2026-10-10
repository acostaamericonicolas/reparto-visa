import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { User } from 'firebase/auth';
import { Unsubscribe, collection, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { Config, Persona, Respaldo } from '../models/config';
import { EstadoPersona, Item, Parte, Resumen } from '../models/resumen';
import { leerResumen, ocultarNumeroTarjeta } from '../shared/lector-resumen';
import { arrastrar } from '../shared/reparto';
import { Firebase } from './firebase';
import { Pdf } from './pdf';
import { Sesion } from './sesion';

const CONFIG_VACIA: Config = { personas: [], tarjetas: {} };

export interface ResultadoImportacion {
  resumen: Resumen;
  avisos: string[];
  completados: number;
  pendientes: number;
}

/**
 * Datos compartidos (Firestore): `config/app` con las personas y `resumenes/{cierre}` con cada mes.
 * Los cambios se aplican al instante en pantalla y se guardan medio segundo después.
 */
@Injectable({ providedIn: 'root' })
export class Datos {
  private firebase = inject(Firebase);
  private sesion = inject(Sesion);
  private pdf = inject(Pdf);

  readonly config = signal<Config>(CONFIG_VACIA);
  readonly resumenes = signal<Record<string, Resumen>>({});
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly soloLectura = signal(false);

  /** Ids (fecha de cierre) ordenados del más viejo al más nuevo. */
  readonly ids = computed(() => Object.keys(this.resumenes()).sort());
  readonly personas = computed(() => this.config().personas);

  private desuscribir: Unsubscribe[] = [];
  /** Meses con cambios locales todavía sin guardar: no se pisan con lo que llega de Firestore. */
  private sinGuardar = new Map<string, ReturnType<typeof setTimeout>>();
  private cola: Promise<unknown> = Promise.resolve();

  constructor() {
    effect(() => {
      const usuario = this.sesion.usuario();
      untracked(() => this.conectar(usuario));
    });
  }

  persona(id: string): Persona | undefined {
    return this.personas().find((p) => p.id === id);
  }

  private conectar(usuario: User | null | undefined) {
    this.desuscribir.forEach((f) => f());
    this.desuscribir = [];
    this.resumenes.set({});
    this.config.set(CONFIG_VACIA);
    this.cargando.set(true);
    this.error.set('');
    this.soloLectura.set(false);
    if (!usuario) return;

    const db = this.firebase.db;
    const alFallar = (e: { code?: string }) => {
      if (e.code === 'permission-denied') this.sesion.sinAcceso();
      else this.error.set('Se perdió la conexión con Firebase. Recargá la página.');
    };

    this.desuscribir.push(
      onSnapshot(
        doc(db, 'config/app'),
        (s) => {
          if (s.metadata.hasPendingWrites) return;
          const d = s.data() as Partial<Config> | undefined;
          const tarjetas = Object.fromEntries(
            Object.entries(d?.tarjetas ?? {}).map(([t, p]) => [ocultarNumeroTarjeta(t), p]),
          );
          const config: Config = { personas: d?.personas ?? [], tarjetas, alias: d?.alias ?? '' };
          // Datos guardados antes de ocultar los números de tarjeta: se corrigen una sola vez.
          if (Object.keys(tarjetas).join() !== Object.keys(d?.tarjetas ?? {}).join()) this.guardarConfig(config);
          else this.config.set(config);
        },
        alFallar,
      ),
      onSnapshot(
        collection(db, 'resumenes'),
        (s) => {
          const nuevos: Record<string, Resumen> = {};
          const actuales = this.resumenes();
          const aCorregir: string[] = [];
          for (const d of s.docs) {
            const local = this.sinGuardar.has(d.id) || d.metadata.hasPendingWrites;
            if (local && actuales[d.id]) {
              nuevos[d.id] = actuales[d.id];
              continue;
            }
            const original = d.data() as Resumen;
            nuevos[d.id] = normalizar(original);
            if (original.rows.some((r, i) => r.tarjeta !== nuevos[d.id].rows[i].tarjeta)) aCorregir.push(d.id);
          }
          this.resumenes.set(nuevos);
          this.cargando.set(false);
          // Meses guardados con el número de tarjeta completo: se guardan de nuevo ya corregidos.
          for (const id of aCorregir) this.actualizar(id, () => {});
        },
        alFallar,
      ),
    );
  }

  /** Cambia un mes en pantalla y programa el guardado. */
  actualizar(id: string, cambio: (r: Resumen) => void) {
    const actual = this.resumenes()[id];
    if (!actual) return;
    const copia = structuredClone(actual);
    cambio(copia);
    this.resumenes.update((m) => ({ ...m, [id]: copia }));
    clearTimeout(this.sinGuardar.get(id));
    this.sinGuardar.set(
      id,
      setTimeout(() => this.guardarResumen(id), 500),
    );
  }

  /** Reemplaza las partes de un ítem. */
  cambiarPartes(id: string, itemId: string, partes: Parte[]) {
    this.actualizar(id, (r) => {
      const item = r.rows.find((x) => x.id === itemId);
      if (item) item.partes = partes;
    });
  }

  /** Marca o desmarca "avisado" o "pagado" para una persona en un mes. */
  cambiarEstado(id: string, persona: string, campo: keyof EstadoPersona, valor: boolean) {
    this.actualizar(id, (r) => {
      const estados = (r.estados ??= {});
      estados[persona] = { ...(estados[persona] ?? { avisado: false, pagado: false }), [campo]: valor };
    });
  }

  private guardarResumen(id: string) {
    this.encolar(async () => {
      await setDoc(doc(this.firebase.db, 'resumenes', id), this.resumenes()[id]);
      this.sinGuardar.delete(id);
    });
  }

  guardarConfig(config: Config) {
    this.config.set(config);
    this.encolar(() => setDoc(doc(this.firebase.db, 'config/app'), config));
  }

  /** Las escrituras van de a una y en orden. */
  private encolar(tarea: () => Promise<unknown>) {
    this.cola = this.cola.then(tarea).catch((e: { code?: string }) => {
      if (e.code === 'permission-denied') {
        this.soloLectura.set(true);
        this.error.set('Esta cuenta no tiene permiso para guardar cambios.');
      } else {
        this.error.set('No se pudo guardar el último cambio. Revisá la conexión y volvé a intentar.');
      }
    });
    return this.cola;
  }

  /** Otros meses ordenados para autocompletar `id`: primero los más lejanos, así gana el más cercano. */
  private otrosMeses(id: string): Resumen[] {
    const distancia = (x: string) => Math.abs(Date.parse(x) - Date.parse(id));
    return this.ids()
      .filter((x) => x !== id)
      .sort((a, b) => distancia(b) - distancia(a))
      .map((x) => this.resumenes()[x]);
  }

  /** Lee el PDF, completa lo que ya se conoce de otros meses y lo guarda. */
  async importar(archivo: File): Promise<ResultadoImportacion> {
    const { resumen, avisos } = leerResumen(await this.pdf.leerTextos(archivo));
    const id = resumen.meta.id;
    // Si se vuelve a importar un mes, su propio reparto tiene prioridad.
    const otros = [...this.otrosMeses(id), ...(this.resumenes()[id] ? [this.resumenes()[id]] : [])];
    const completados = arrastrar(resumen.rows, otros, this.config().tarjetas);
    resumen.importado = new Date().toISOString();
    this.resumenes.update((m) => ({ ...m, [id]: resumen }));
    await this.encolar(() => setDoc(doc(this.firebase.db, 'resumenes', id), resumen));
    const pendientes = resumen.rows.filter((r) => !r.partes.length).length;
    return { resumen, avisos, completados, pendientes };
  }

  /** Completa los ítems sin asignar de un mes con el reparto de los otros meses. */
  completar(id: string): number {
    let completados = 0;
    this.actualizar(id, (r) => (completados = arrastrar(r.rows, this.otrosMeses(id), this.config().tarjetas)));
    return completados;
  }

  respaldo(): Respaldo {
    return {
      formato: 'reparto-visa-respaldo',
      version: 1,
      exportado: new Date().toISOString(),
      config: this.config(),
      resumenes: this.resumenes(),
    };
  }

  /** Escribe los meses del archivo (y las personas, si vienen) en una sola operación. */
  async restaurar(respaldo: Partial<Respaldo>): Promise<number> {
    if (respaldo.formato !== 'reparto-visa-respaldo' || !respaldo.resumenes) {
      throw new Error('Ese archivo no es un respaldo de Reparto Visa.');
    }
    const lote = writeBatch(this.firebase.db);
    if (respaldo.config) lote.set(doc(this.firebase.db, 'config/app'), respaldo.config);
    for (const [id, r] of Object.entries(respaldo.resumenes)) lote.set(doc(this.firebase.db, 'resumenes', id), r);
    await this.encolar(() => lote.commit());
    return Object.keys(respaldo.resumenes).length;
  }

  /** Borra una persona y deja sin asignar sus partes en todos los meses. */
  eliminarPersona(id: string) {
    const c = this.config();
    const tarjetas = Object.fromEntries(Object.entries(c.tarjetas).filter(([, p]) => p !== id));
    this.guardarConfig({ ...c, personas: c.personas.filter((p) => p.id !== id), tarjetas });
    for (const mes of this.ids()) {
      if (this.resumenes()[mes].rows.some((r) => r.partes.some((p) => p.p === id))) {
        this.actualizar(mes, (r) => r.rows.forEach((it) => (it.partes = it.partes.filter((p) => p.p !== id))));
      }
    }
  }
}

/** Completa campos que pueden faltar en documentos viejos. */
function normalizar(r: Resumen): Resumen {
  return {
    ...r,
    rows: r.rows.map((it: Item) => ({ ...it, tarjeta: ocultarNumeroTarjeta(it.tarjeta), partes: it.partes ?? [] })),
    meta: { ...r.meta, totalesTarjeta: r.meta.totalesTarjeta?.map((t) => ({ ...t, tarjeta: ocultarNumeroTarjeta(t.tarjeta) })) },
  };
}
