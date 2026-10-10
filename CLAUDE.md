# CLAUDE.md — AFIN (reparto-visa)

Contexto y reglas de trabajo para Claude en este repo. El detalle funcional está en README.md.

## Reglas
- Trabajar siempre sobre la rama `branch-acosta`. No tocar `main` ni otras ramas.
- Todo cambio se prueba en el canal de prueba antes del deploy a producción:
  1. `npm run preview` (build + deploy al canal `prueba` de Firebase Hosting, expira en 7 días).
  2. Probar en https://reparto-visa-acosta--prueba-8kkoatsj.web.app/?mes=2026-07-30
  3. Solo si funciona bien: `npm run deploy` (build + deploy a producción).
- Correr `npm test` antes de publicar.
- Responder en español rioplatense.

## Proyecto
- Angular 22 (standalone, signals, Signal Forms), Firebase Hosting + Firestore, login con Google.
- Proyecto Firebase: `reparto-visa-acosta`.
- `ng serve` usa emuladores (`npm run emuladores` en otra terminal), nunca datos reales.
- Lógica pura y con tests en `src/app/shared/`; pantallas en `src/app/features/`.
