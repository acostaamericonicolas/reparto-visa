# Reparto Visa

App web para repartir el resumen de la tarjeta Visa ICBC entre las personas que la usan.

- Importa el PDF del resumen y arma la tabla (fecha, detalle, cuota, pesos, dólares).
- Cada ítem se asigna a una persona o se divide entre varias.
- Las cuotas que ya se repartieron en meses anteriores se completan solas.
- Los impuestos y cargos van en un solo ítem, con el desglose en una ventana.
- Muestra el total de cada persona y copia su detalle para mandarlo.

## Tecnología

HTML + JavaScript sin build, Firebase Hosting, Firestore y login con Google. El PDF se lee en el navegador con pdf.js.

## Acceso

Solo entran las cuentas listadas en `firestore.rules`. Para sumar a alguien, agregá su mail y ejecutá:

```bash
firebase deploy --only firestore:rules
```

## Desplegar

```bash
firebase deploy
```

## Datos

- `config/app`: personas y dueño por defecto de cada tarjeta.
- `resumenes/{fecha de cierre}`: ítems del mes con su reparto.

Desde "Personas y tarjetas → Respaldo" se descarga o restaura una copia en JSON. Los respaldos no se suben al repo.
