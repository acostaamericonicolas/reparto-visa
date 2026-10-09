// Corre el lector de la app sobre los PDF de una carpeta y controla que cada tarjeta
// sume lo mismo que el "Total Consumos" del banco.
// Uso: npm run verificar -- "C:/ruta/a/la/carpeta"
import { build } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const carpeta = process.argv[2];
if (!carpeta) {
  console.error('Indicá la carpeta con los PDF: npm run verificar -- "C:/ruta"');
  process.exit(1);
}

const salida = join(tmpdir(), 'lector-resumen.mjs');
await build({ entryPoints: ['src/app/shared/lector-resumen.ts'], bundle: true, format: 'esm', platform: 'node', outfile: salida, logLevel: 'error' });
const { leerResumen } = await import(pathToFileURL(salida).href);

let errores = 0;
for (const archivo of readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()) {
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(join(carpeta, archivo))), verbosity: 0 }).promise;
  const textos = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const contenido = await (await pdf.getPage(i)).getTextContent();
    for (const it of contenido.items) if (it.str) textos.push({ page: i, x: it.transform[4], y: it.transform[5], str: it.str });
  }
  try {
    const { resumen, avisos } = leerResumen(textos);
    const imp = resumen.rows.find((r) => r.tipo === 'impuestos');
    console.log(`${avisos.length ? '✗' : '✓'} ${archivo}: cierre ${resumen.meta.cierre}, ${resumen.rows.length} ítems, ` +
      `${resumen.meta.totalesTarjeta.length} tarjetas, impuestos ${imp?.items?.length ?? 0}, cuotas a vencer ${resumen.meta.cuotasAVencer.length}`);
    for (const a of avisos) console.log('   ' + a);
    errores += avisos.length;
  } catch (e) {
    console.log(`✗ ${archivo}: ${e.message}`);
    errores++;
  }
}
process.exit(errores ? 1 : 0);
