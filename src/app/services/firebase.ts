import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

/** Única instancia de Firebase de la app. Con `ng serve` se conecta a los emuladores locales. */
@Injectable({ providedIn: 'root' })
export class Firebase {
  readonly app = initializeApp(environment.firebase);
  readonly auth = getAuth(this.app);
  // Los campos opcionales sin valor (ej. `origen`) no se guardan, en vez de dar error.
  readonly db = initializeFirestore(this.app, { ignoreUndefinedProperties: true });

  constructor() {
    if (environment.emuladores) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(this.db, '127.0.0.1', 8080);
    }
  }
}
