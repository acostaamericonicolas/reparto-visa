import { Injectable } from '@angular/core';
import { TextoPdf } from '../shared/lector-resumen';

/** Extrae los textos del PDF con su posición. pdf.js se carga recién cuando se importa un resumen. */
@Injectable({ providedIn: 'root' })
export class Pdf {
  async leerTextos(archivo: File): Promise<TextoPdf[]> {
    const pdfjs = await import('pdfjs-dist');
    // El worker se copia a /pdfjs en el build (angular.json → assets).
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await archivo.arrayBuffer()),
      // Seguridad: pdf.js 6 ya no evalúa código del PDF y la CSP del sitio bloquea eval igual.
      // Solo se lee texto: sin formularios XFA ni WebAssembly.
      enableXfa: false,
      useWasm: false,
      stopAtErrors: true,
    }).promise;
    const textos: TextoPdf[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const contenido = await (await pdf.getPage(i)).getTextContent();
      for (const it of contenido.items) {
        if ('str' in it && it.str) textos.push({ page: i, x: it.transform[4], y: it.transform[5], str: it.str });
      }
    }
    return textos;
  }
}
