import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: el :id de la ruta llega como input al componente.
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'es-AR' },
  ],
};
