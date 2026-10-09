import { Component, input, output, signal } from '@angular/core';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { Cotizacion, FuentesCotizacion, mejoresCotizaciones } from '../../../shared/cotizaciones';
import { mensajeDeError } from '../../../shared/errores';

const API = 'https://criptoya.com/api/';

/** Compara el precio de compra del dólar en bancos, casas de cambio y apps (fuente: CriptoYa). */
@Component({
  selector: 'app-cotizaciones',
  imports: [PesosPipe],
  templateUrl: './cotizaciones.html',
  styles: '.desplazable { overflow-x: auto; margin-top: 8px; } p.ayuda { margin-top: 8px; }',
})
export class Cotizaciones {
  /** Cotización que se está usando, para mostrar cuánto más barata o cara es cada opción. */
  actual = input(0);
  elegida = output<number>();

  protected lista = signal<Cotizacion[] | null>(null);
  protected cargando = signal(false);
  protected error = signal('');

  protected async consultar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const pedir = async (ruta: string) => {
        const r = await fetch(API + ruta);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      };
      const [dolar, usdt, usdc, bancos] = await Promise.all([pedir('dolar'), pedir('usdt/ars/1'), pedir('usdc/ars/1'), pedir('bancostodos')]);
      this.lista.set(mejoresCotizaciones({ dolar, usdt, usdc, bancos } as FuentesCotizacion, Date.now() / 1000));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo consultar CriptoYa.'));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Diferencia contra la cotización actual, en %. Negativo = más barata. */
  protected diferencia(precio: number): number | null {
    return this.actual() > 0 ? ((precio - this.actual()) / this.actual()) * 100 : null;
  }

  protected usar(precio: number) {
    this.elegida.emit(Math.round(precio * 100) / 100);
  }

  protected tipo(c: Cotizacion): string {
    return c.tipo === 'oficial' ? 'Oficial' : c.tipo === 'banco' ? 'Banco / casa de cambio' : 'App / exchange (USDT, USDC)';
  }
}
