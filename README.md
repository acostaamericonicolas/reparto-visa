# Reparto Visa

App web para repartir el resumen de la tarjeta Visa ICBC entre las personas que la usan.

- Importa el PDF del resumen y arma la tabla (fecha, detalle, cuota, pesos, dólares), controlando que cada tarjeta sume lo mismo que informa el banco.
- Cada ítem se asigna a una persona o se divide entre varias.
- Las cuotas que ya se repartieron en otros meses se completan solas.
- Los impuestos y cargos van en un solo ítem, con el desglose en una ventana.
- Muestra el total de cada persona y copia su detalle para mandarlo.
- Gráficos: gasto por mes y por persona, variación contra el mes anterior y proyección de las cuotas pendientes.

## Tecnología

Angular 22 (standalone, signals, Signal Forms), Firebase Hosting, Firestore y login con Google. El PDF se lee en el navegador con pdf.js y los gráficos usan Chart.js.

## Estructura

```
src/app/
  models/      Resumen, Item, Parte, Config
  services/    firebase, sesion (login), datos (Firestore), pdf
  shared/      lógica sin Angular: lector-resumen, reparto, estadisticas, montos, fechas (con tests)
  pipes/       pesos, dolares, monto, variacion
  guards/      sesion.guard
  features/    login, resumen (pestañas, totales, tabla, impuestos), graficos, personas
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

Desde "Personas → Respaldo" se descarga o restaura una copia en JSON. Los respaldos no se suben al repo.
