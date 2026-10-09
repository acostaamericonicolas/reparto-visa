# Reparto Visa

App web para repartir el resumen de la tarjeta Visa ICBC entre las personas que la usan.

- Importa el PDF del resumen y arma la tabla (fecha, detalle, cuota, pesos, dólares), controlando que cada tarjeta sume lo mismo que informa el banco.
- Cada ítem se asigna a una persona o se divide entre varias.
- Las cuotas que ya se repartieron en otros meses se completan solas.
- Los impuestos y cargos van en un solo ítem, con el desglose en una ventana.
- Muestra el total de cada persona y copia su detalle para mandarlo.
- Gráficos: gasto por mes y por persona, variación contra el mes anterior y proyección de las cuotas pendientes.

## Hogar

Sección **Hogar** (`/hogar`) para llevar los gastos de la casa de dos personas:

- Sueldos, gastos compartidos (con estimado y real, y quién los adelantó) y ahorro en dólares.
- Lo que queda libre después de gastos compartidos y tarjetas se divide en partes iguales; calcula cuánto transfiere cada uno a la cuenta común.
- **Estimado vs. real** por categoría: lo que se pasa del estimado se marca en rojo.
- **Tarjetas:** "Traer de Reparto Visa" toma, del resumen que **vence** en el mes, solo la parte de cada uno (lo de otras personas y lo que no tiene dueño se informa pero no se suma).
- Comparador de cotizaciones del dólar (CriptoYa) y gráficos por mes y por categoría.
- Un mes nuevo hereda del anterior: lo gastado pasa a ser el estimado y el real queda pendiente.
- **Gastos recurrentes:** los que se repiten todos los meses pasan solos al mes siguiente; los de una sola vez se destildan y se quedan en su mes. Si un gasto cambia 10 % o más contra el mes anterior, se avisa.
- **Metas de ahorro:** objetivo en dólares (por defecto, la casa propia), cuánto se lleva, cuánto falta y en cuánto tiempo se llega al ritmo de los últimos 3 meses. Solo cuentan los dólares comprados. Las metas se llenan en orden.

Quién es cada uno se elige en Hogar → Ajustes (por defecto, las personas que se llaman "Nico" y "Nanu").

## Tecnología

Angular 22 (standalone, signals, Signal Forms), Firebase Hosting, Firestore y login con Google. El PDF se lee en el navegador con pdf.js y los gráficos usan Chart.js.

## Estructura

```
src/app/
  models/      Resumen, Item, Parte, Config, hogar (MesHogar, ConfigHogar)
  services/    firebase, sesion (login), datos (Firestore), hogar (Firestore), pdf
  shared/      lógica sin Angular: lector-resumen, reparto, estadisticas, montos, fechas, hogar, cotizaciones (con tests)
  pipes/       pesos, dolares, monto, variacion
  guards/      sesion.guard
  features/    login, resumen (pestañas, totales, tabla, impuestos), graficos, personas, hogar (mes, resultados, historial, ajustes, cotizaciones)
scripts/       verificar-resumenes.mjs
```

## Desarrollo

`ng serve` trabaja contra los emuladores de Firebase, nunca contra los datos reales. En dos terminales:

```bash
npm run emuladores
```

```bash
npm start
```

En la pantalla de login aparece "Entrar de prueba" (solo con emuladores).

```bash
npm test
```

Para controlar el lector contra PDFs reales (no se suben al repo):

```bash
npm run verificar -- "C:/ruta/a/la/carpeta/con/pdfs"
```

## Instalar en el celular

La versión publicada es una PWA: se puede instalar desde el navegador (Chrome: menú → "Instalar app" o "Agregar a la pantalla principal") y abre como una app. Funciona con `@angular/service-worker` (`ngsw-config.json`), que solo se activa en el build de producción, no con `ng serve`. Cuando se publica una versión nueva, la app avisa "Hay una versión nueva" con un botón para actualizar.

Los íconos están en `public/`. Después del primer deploy conviene comprobar que `ngsw-worker.js`, `ngsw.json` y `manifest.webmanifest` se sirvan sin caché: `curl -I https://<sitio>/ngsw-worker.js` tiene que mostrar `Cache-Control: no-cache`.

## Desplegar

```bash
npm run preview
```

publica en un canal de prueba de Firebase (URL temporal, 7 días, con los datos reales).

```bash
npm run deploy
```

publica la versión oficial.

## Acceso

Solo entran las cuentas listadas en `firestore.rules`. Para sumar a alguien, agregá su mail y ejecutá:

```bash
firebase deploy --only firestore:rules
```

## Datos

- `config/app`: personas y dueño por defecto de cada tarjeta.
- `resumenes/{fecha de cierre}`: ítems del mes con su reparto.
- `hogar/config`: categorías y qué persona de `config/app` es cada uno.
- `hogar/mes-{yyyy-mm}`: sueldos, gastos, ahorro en dólares y tarjetas de cada mes del hogar.

Desde "Personas → Respaldo" se descarga o restaura una copia en JSON, y desde "Hogar → Ajustes → Respaldo" la de los gastos del hogar. Los respaldos no se suben al repo.
