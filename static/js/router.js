/* ══════════════════════════════════════════════════════════
   Bitácora — solo maquetación.
   Este archivo únicamente carga los iconos, cambia de vista
   y abre/cierra el menú en móvil. No hay lógica de datos,
   persistencia, ni llamadas a ningún proveedor.
   ══════════════════════════════════════════════════════════ */

// 1. Los iconos SVG van inline en el HTML (sprite <symbol>), asi el archivo
//    funciona abierto directo desde el disco sin servidor.

// 2. Router de vistas por hash
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item');

function showView(name) {
  const target = document.getElementById('view-' + name);
  if (!target) return;

  views.forEach(v => v.classList.remove('is-visible'));
  target.classList.add('is-visible');

  navItems.forEach(n => n.classList.toggle('is-active', n.dataset.view === name));

  document.querySelector('.sidebar').classList.remove('is-open');
  window.scrollTo({ top: 0 });
}

function routeFromHash() {
  const name = (location.hash || '#inicio').slice(1);
  showView(name);
}

window.addEventListener('hashchange', routeFromHash);
routeFromHash();

// 3. Menú móvil
document.querySelector('.menu-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('.sidebar').classList.toggle('is-open');
});

document.addEventListener('click', (e) => {
  const side = document.querySelector('.sidebar');
  if (side.classList.contains('is-open') && !side.contains(e.target)) {
    side.classList.remove('is-open');
  }
});

// 4. Chips y segmentos: solo el estado visual activo, sin filtrar nada
document.querySelectorAll('.chip-row, .seg').forEach(group => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip, .seg-btn');
    if (!btn) return;
    group.querySelectorAll('.chip, .seg-btn').forEach(b => b.classList.remove('is-on'));
    btn.classList.add('is-on');
  });
});

