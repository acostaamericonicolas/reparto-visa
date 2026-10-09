import { ApplicationConfig, LOCALE_ID, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el :id de la ruta llega como input al componente.
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    // Hace la app instalable y la deja abrir sin conexión. Solo en la versión publicada, no con `ng serve`.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
  ],
};
