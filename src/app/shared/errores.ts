/** Texto para mostrarle a la persona a partir de un error; si no trae mensaje, el texto por defecto. */
export function mensajeDeError(e: unknown, defecto = 'Ocurrió un error. Probá de nuevo.'): string {
  const mensaje = (e as { message?: unknown } | null)?.message;
  return typeof mensaje === 'string' && mensaje.trim() !== '' ? mensaje : defecto;
}
