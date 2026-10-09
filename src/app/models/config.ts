import { Resumen } from './resumen';

export interface Persona {
  id: string;
  nombre: string;
}

/** Personas y dueño por defecto de cada tarjeta (documento config/app). */
export interface Config {
  personas: Persona[];
  /** Nombre de la tarjeta tal como sale en el resumen → id de persona. */
  tarjetas: Record<string, string>;
}

/** Archivo de respaldo que se descarga o restaura desde la app. */
export interface Respaldo {
  formato: 'reparto-visa-respaldo';
  version: 1;
  exportado: string;
  config: Config;
  resumenes: Record<string, Resumen>;
}
