// Tema elegido con el sol/luna (ver src/app/services/tema.ts). Sin elección guardada, sigue al sistema.
try {
  var tema = localStorage.getItem('tema');
  if (tema === 'claro' || tema === 'oscuro') document.documentElement.setAttribute('data-tema', tema);
} catch (e) {}
