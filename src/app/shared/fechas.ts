const MESES_CORTOS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** "01 Oct 26" (formato del resumen) → "2026-10-01". */
export function fechaIso(texto: string | undefined): string | null {
  const m = /(\d{2}) (\w{3}) (\d{2})/.exec(texto ?? '');
  if (!m) return null;
  const mes = MESES_CORTOS[m[2].toLowerCase()];
  if (!mes) return null;
  return `20${m[3]}-${String(mes).padStart(2, '0')}-${m[1]}`;
}

/** "2026-10-14" → "Octubre 2026". */
export function nombreMes(iso: string): string {
  const nombre = MESES[+iso.slice(5, 7) - 1] ?? '';
  return nombre.charAt(0).toUpperCase() + nombre.slice(1) + ' ' + iso.slice(0, 4);
}

/** "2026-10-14" → "Oct 26" (para ejes de gráficos). */
export function mesCorto(iso: string): string {
  const nombre = MESES[+iso.slice(5, 7) - 1] ?? '';
  return nombre.charAt(0).toUpperCase() + nombre.slice(1, 3) + ' ' + iso.slice(2, 4);
}

/** Suma meses a un "yyyy-mm" y devuelve otro "yyyy-mm". */
export function sumarMeses(anioMes: string, n: number): string {
  const [a, m] = anioMes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
