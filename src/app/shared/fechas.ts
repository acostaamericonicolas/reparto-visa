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

/** Resta días a una fecha "yyyy-mm-dd" y la devuelve como "dd/mm" (ej. "2026-10-14", 2 → "12/10"). */
export function diaMesAntes(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d - dias));
  return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Suma meses a un "yyyy-mm" y devuelve otro "yyyy-mm". */
export function sumarMeses(anioMes: string, n: number): string {
  const [a, m] = anioMes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Meses todavía sin resumen que se muestran "apagados": del mes de hoy a `cantidad` meses más ("yyyy-mm"),
 * salteando el último mes cargado y los anteriores (`ultimo` es el "yyyy-mm" en que vence el último resumen).
 */
export function mesesFuturos(hoy: string, ultimo: string | null, cantidad = 2): string[] {
  const meses: string[] = [];
  for (let i = 0; i <= cantidad; i++) {
    const mes = sumarMeses(hoy, i);
    if (!ultimo || mes > ultimo) meses.push(mes);
  }
  return meses;
}
