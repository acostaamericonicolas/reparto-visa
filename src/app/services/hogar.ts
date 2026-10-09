import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { User } from 'firebase/auth';
import { Unsubscribe, collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { Persona } from '../models/config';
import { CATEGORIAS_INICIALES, ConfigHogar, MesHogar, MetaAhorro, Quien, RespaldoHogar } from '../models/hogar';
import { mesAnterior, mesNuevo } from '../shared/hogar';
import { Datos } from './datos';
import { Firebase } from './firebase';
import { Sesion } from './sesion';

/** Para lo que se ahorra: la casa propia. El objetivo en dólares lo definen ellos. */
const METAS_INICIALES: MetaAhorro[] = [{ id: 'casa', nombre: 'Casa propia', objetivoUsd: 0, hasta: '' }];
const CONFIG_INICIAL: ConfigHogar = {
  categorias: CATEGORIAS_INICIALES,
  metas: METAS_INICIALES,
  ahorroInicialUsd: 0,
  personas: { nico: '', nanu: '' },
};
const PREFIJO_MES = 'mes-';

/**
 * Gastos del hogar (Firestore): colección `hogar` con `config` y un documento por mes (`mes-2026-10`).
 * Es independiente de los resúmenes de la tarjeta (`resumenes/`), que solo se leen desde `Datos`.
 * Los cambios se aplican al instante en pantalla y se guardan medio segundo después.
 */
@Injectable({ providedIn: 'root' })
export class Hogar {
  private firebase = inject(Firebase);
  private sesion = inject(Sesion);
  private datos = inject(Datos);

  readonly config = signal<ConfigHogar>(CONFIG_INICIAL);
  readonly meses = signal<Record<string, MesHogar>>({});
  readonly cargando = signal(true);
  readonly error = signal('');

  /** Ids ("2026-10") ordenados del más viejo al más nuevo. */
  readonly ids = computed(() => Object.keys(this.meses()).sort());

  /**
   * Quién es cada uno entre las personas de la tarjeta: la elegida en Ajustes o, si no hay, la que se llama
   * igual ("Nico", "Nanu"). `null` si falta alguna o son la misma.
   */
  readonly personas = computed<Record<Quien, Persona> | null>(() => {
    const lista = this.datos.personas();
    const elegir = (q: Quien) =>
      lista.find((p) => p.id === this.config().personas[q]) ?? lista.find((p) => p.nombre.trim().toLowerCase() === q);
    const nico = elegir('nico');
    const nanu = elegir('nanu');
    return nico && nanu && nico.id !== nanu.id ? { nico, nanu } : null;
  });
  readonly nombres = computed<Record<Quien, string>>(() => ({
    nico: this.personas()?.nico.nombre ?? 'Nico',
    nanu: this.personas()?.nanu.nombre ?? 'Nanu',
  }));

  private desuscribir?: Unsubscribe;
  /** Meses con cambios locales todavía sin guardar: no se pisan con lo que llega de Firestore. */
  private sinGuardar = new Map<string, ReturnType<typeof setTimeout>>();
  private cola: Promise<unknown> = Promise.resolve();

  constructor() {
    effect(() => {
      const usuario = this.sesion.usuario();
      untracked(() => this.conectar(usuario));
    });
  }

  private conectar(usuario: User | null | undefined) {
    this.desuscribir?.();
    this.desuscribir = undefined;
    this.meses.set({});
    this.config.set(CONFIG_INICIAL);
    this.cargando.set(true);
    this.error.set('');
    if (!usuario) return;

    this.desuscribir = onSnapshot(
      collection(this.firebase.db, 'hogar'),
      (s) => {
        const nuevos: Record<string, MesHogar> = {};
        const actuales = this.meses();
        for (const d of s.docs) {
          if (d.id === 'config') {
            if (!d.metadata.hasPendingWrites) this.config.set(normalizarConfig(d.data() as Partial<ConfigHogar>));
          } else if (d.id.startsWith(PREFIJO_MES)) {
            const id = d.id.slice(PREFIJO_MES.length);
            const local = this.sinGuardar.has(id) || d.metadata.hasPendingWrites;
            nuevos[id] = local && actuales[id] ? actuales[id] : normalizarMes(d.data() as Partial<MesHogar>);
          }
        }
        // Un mes con cambios sin guardar que todavía no volvió de Firestore se conserva.
        for (const id of this.sinGuardar.keys()) if (!nuevos[id] && actuales[id]) nuevos[id] = actuales[id];
        this.meses.set(nuevos);
        this.cargando.set(false);
      },
      (e: { code?: string }) => {
        if (e.code === 'permission-denied') this.sesion.sinAcceso();
        else this.error.set('Se perdió la conexión con Firebase. Recargá la página.');
      },
    );
  }

  /** Cambia un mes en pantalla y programa el guardado. */
  actualizar(id: string, cambio: (m: MesHogar) => void) {
    const actual = this.meses()[id];
    if (!actual) return;
    const copia = structuredClone(actual);
    cambio(copia);
    this.meses.update((todos) => ({ ...todos, [id]: copia }));
    clearTimeout(this.sinGuardar.get(id));
    this.sinGuardar.set(
      id,
      setTimeout(() => this.guardarMes(id), 500),
    );
  }

  /** Crea un mes heredando del anterior (sueldos, gastos y ahorro; lo gastado pasa a ser el estimado). */
  crearMes(id: string) {
    const anterior = mesAnterior(this.ids(), id);
    const mes = mesNuevo(anterior ? this.meses()[anterior] : undefined, nuevoId);
    this.meses.update((todos) => ({ ...todos, [id]: mes }));
    return this.encolar(() => setDoc(this.docMes(id), mes));
  }

  async eliminarMes(id: string) {
    clearTimeout(this.sinGuardar.get(id));
    this.sinGuardar.delete(id);
    this.meses.update((todos) => Object.fromEntries(Object.entries(todos).filter(([k]) => k !== id)));
    await this.encolar(() => deleteDoc(this.docMes(id)));
  }

  guardarConfig(config: ConfigHogar) {
    this.config.set(config);
    this.encolar(() => setDoc(doc(this.firebase.db, 'hogar', 'config'), config));
  }

  respaldo(): RespaldoHogar {
    return { formato: 'hogar-respaldo', version: 1, exportado: new Date().toISOString(), config: this.config(), meses: this.meses() };
  }

  /** Escribe la configuración y los meses del archivo en una sola operación. */
  async restaurar(respaldo: Partial<RespaldoHogar>): Promise<number> {
    if (respaldo.formato !== 'hogar-respaldo' || !respaldo.meses) throw new Error('Ese archivo no es un respaldo de Gastos del hogar.');
    const lote = writeBatch(this.firebase.db);
    if (respaldo.config) lote.set(doc(this.firebase.db, 'hogar', 'config'), normalizarConfig(respaldo.config));
    for (const [id, m] of Object.entries(respaldo.meses)) lote.set(this.docMes(id), normalizarMes(m));
    await this.encolar(() => lote.commit());
    return Object.keys(respaldo.meses).length;
  }

  private docMes = (id: string) => doc(this.firebase.db, 'hogar', PREFIJO_MES + id);

  private guardarMes(id: string) {
    this.encolar(async () => {
      await setDoc(this.docMes(id), this.meses()[id]);
      this.sinGuardar.delete(id);
    });
  }

  /** Las escrituras van de a una y en orden. */
  private encolar(tarea: () => Promise<unknown>) {
    this.cola = this.cola.then(tarea).catch((e: { code?: string }) => {
      this.error.set(
        e.code === 'permission-denied'
          ? 'Esta cuenta no tiene permiso para guardar cambios.'
          : 'No se pudo guardar el último cambio. Revisá la conexión y volvé a intentar.',
      );
    });
    return this.cola;
  }
}

export const nuevoId = (): string => 'g' + Math.random().toString(36).slice(2, 9);

/** Completa campos que pueden faltar en documentos viejos o en respaldos a mano. */
function normalizarConfig(c: Partial<ConfigHogar>): ConfigHogar {
  return {
    categorias: c.categorias?.length ? c.categorias : CATEGORIAS_INICIALES,
    metas: c.metas ?? METAS_INICIALES,
    ahorroInicialUsd: c.ahorroInicialUsd ?? 0,
    personas: { nico: c.personas?.nico ?? '', nanu: c.personas?.nanu ?? '' },
  };
}

function normalizarMes(m: Partial<MesHogar>): MesHogar {
  return {
    ingresos: { nico: m.ingresos?.nico ?? 0, nanu: m.ingresos?.nanu ?? 0 },
    usd: {
      planificados: m.usd?.planificados ?? 0,
      comprados: m.usd?.comprados ?? null,
      cotizacion: m.usd?.cotizacion ?? 0,
      pagadoPor: m.usd?.pagadoPor ?? 'pozo',
    },
    gastos: (m.gastos ?? []).map((g) => ({
      ...g,
      real: g.real ?? null,
      estimado: g.estimado ?? 0,
      categoria: g.categoria || 'Otros',
      recurrente: g.recurrente ?? true,
    })),
    tarjetas: { nico: m.tarjetas?.nico ?? 0, nanu: m.tarjetas?.nanu ?? 0 },
    tarjetasOrigen: m.tarjetasOrigen,
    notas: m.notas ?? '',
  };
}
