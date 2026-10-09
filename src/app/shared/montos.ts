/** Redondea a centavos. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

const FORMATO = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "1.234,50" */
export const formatoMonto = (n: number | null | undefined): string => FORMATO.format(n ?? 0);

/** Lee un monto con formato del resumen: "1.234,56" o "1.234,56-" (negativo). */
export function montoDelResumen(s: string): number {
  const negativo = /-$/.test(s) || /^-/.test(s);
  const v = parseFloat(s.replace(/-/g, '').replace(/\./g, '').replace(',', '.'));
  return r2(negativo ? -v : v);
}

/**
 * Lee lo que escribe la persona en un campo de monto. Acepta "40.000,50", "40000.5" y "40.000".
 */
export function montoIngresado(texto: string): number {
  const s = String(texto).replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) return r2(parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0);
  if (/^\d+\.\d{1,2}$/.test(s)) return r2(parseFloat(s));
  return r2(parseFloat(s.replace(/\./g, '')) || 0);
}

/** Divide un total en n partes iguales; los centavos que sobran van a las primeras. */
export function repartoIgual(total: number, n: number): number[] {
  if (n <= 0) return [];
  const centavos = Math.round(total * 100);
  const base = Math.trunc(centavos / n);
  const resto = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < resto ? 1 : 0)) / 100);
}
