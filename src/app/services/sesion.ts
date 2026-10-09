import { Injectable, inject, signal } from '@angular/core';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Firebase } from './firebase';

/** Login con Google. Quién puede ver los datos lo deciden las reglas de Firestore. */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private firebase = inject(Firebase);

  /** `undefined` mientras Firebase todavía no respondió si hay sesión. */
  readonly usuario = signal<User | null | undefined>(undefined);
  readonly mensaje = signal('');

  private listo!: () => void;
  /** Se resuelve cuando se sabe si hay sesión (lo usa el guard). */
  readonly inicializado = new Promise<void>((ok) => (this.listo = ok));

  constructor() {
    onAuthStateChanged(this.firebase.auth, (u) => {
      this.usuario.set(u);
      this.listo();
    });
  }

  async entrar() {
    this.mensaje.set('');
    try {
      await signInWithPopup(this.firebase.auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.mensaje.set('No se pudo iniciar sesión. Probá de nuevo.');
      }
    }
  }

  /** Solo con los emuladores: entra con una cuenta de Google falsa (el emulador acepta credenciales sin firmar). */
  async entrarDePrueba(email: string) {
    if (!environment.emuladores) return;
    const token = JSON.stringify({ sub: 'prueba-' + email, email, email_verified: true });
    await signInWithCredential(this.firebase.auth, GoogleAuthProvider.credential(token));
  }

  salir() {
    return signOut(this.firebase.auth);
  }

  /** La cuenta entró a Google pero las reglas de Firestore no la dejan leer: se la saca con un aviso. */
  async sinAcceso() {
    const mail = this.usuario()?.email ?? '';
    await this.salir();
    this.mensaje.set(`La cuenta ${mail} no tiene acceso. Entrá con una cuenta autorizada.`);
  }
}
