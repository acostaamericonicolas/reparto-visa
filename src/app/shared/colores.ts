/** Cantidad de colores de persona definidos en styles.css (--p1 … --p8). */
const COLORES = 8;

/** Variable CSS del color de una persona según su posición en la lista ('' = sin asignar). */
export function colorPersona(personas: { id: string }[], id: string): string {
  const i = personas.findIndex((p) => p.id === id);
  return i < 0 ? 'var(--aviso)' : `var(--p${(i % COLORES) + 1})`;
}

/** Valor real de una variable CSS (Chart.js dibuja en canvas y no entiende `var()`). */
export function valorCss(variable: string): string {
  const nombre = variable.replace(/^var\((.+)\)$/, '$1');
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || '#888';
}
