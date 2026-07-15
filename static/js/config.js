const Config = (() => {
  'use strict';

  function init() { bindEvents(); }

  function render() {
    renderProviders();
    renderAppearance();
    renderActions();
  }

  function renderProviders() {
    const container = document.getElementById('config-providers');
    if (!container) return;
    const providers = DB.getAll('ai_providers');
    container.innerHTML = providers.map(p => `
      <div class="panel" style="margin-bottom:10px">
        <div class="panel-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>${p.name}</strong>
            <span class="tag${p.is_active ? ' tag-green' : ''}">${p.is_active ? 'Activo' : 'Inactivo'}</span>
          </div>
          <div style="font-size:12px;color:var(--muted)">
            <div>Endpoint: ${p.endpoint}</div>
            <div>Modelo: ${p.default_model}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary btn-sm" data-action="activate" data-id="${p.id}">Activar</button>
            <button class="btn btn-ghost btn-sm" data-action="test" data-id="${p.id}">Probar</button>
          </div>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        if (action === 'activate') activateProvider(id);
        else if (action === 'test') testProvider(id);
      });
    });
  }

  function renderAppearance() {
    const container = document.getElementById('config-appearance');
    if (!container) return;
    container.innerHTML = `
      <div style="margin-bottom:16px">
        <strong style="font-size:13px;display:block;margin-bottom:10px">Tema</strong>
        <button class="btn btn-ghost btn-sm" id="btn-toggle-theme">
          <svg class="ico"><use href="#i-ajustes"></use></svg>
          ${document.documentElement.dataset.theme === 'light' ? 'Cambiar a oscuro' : 'Cambiar a claro'}
        </button>
      </div>
      <div>
        <strong style="font-size:13px;display:block;margin-bottom:10px">Color de acento</strong>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[
            { color: '#3fb950', name: 'Verde' },
            { color: '#58a6ff', name: 'Azul' },
            { color: '#a371f7', name: 'Purpura' },
            { color: '#f85149', name: 'Rojo' },
            { color: '#39c5cf', name: 'Cyan' },
            { color: '#d29922', name: 'Naranja' }
          ].map(c => `
            <button class="btn btn-ghost btn-sm" data-accent="${c.color}"
              style="background:${c.color}20;border-color:${c.color}40;color:${c.color}">
              ${c.name}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.getElementById('btn-toggle-theme')?.addEventListener('click', toggleTheme);
    container.querySelectorAll('[data-accent]').forEach(btn => {
      btn.addEventListener('click', () => setAccent(btn.dataset.accent));
    });
  }

  function renderActions() {
    const container = document.getElementById('config-actions');
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-ghost btn-block" id="btn-export">
          <svg class="ico"><use href="#i-externo"></use></svg>Exportar datos
        </button>
        <button class="btn btn-ghost btn-block" id="btn-import">
          <svg class="ico"><use href="#i-externo"></use></svg>Importar datos
        </button>
      </div>
      <div class="panel panel-danger" style="margin-top:16px">
        <div class="panel-body">
          <div class="danger-row">
            <div>
              <strong style="color:var(--red)">Zona de peligro</strong>
              <p class="panel-note">Eliminar todos los datos permanentemente.</p>
            </div>
            <button class="btn btn-danger btn-sm" id="btn-reset">Eliminar todo</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('btn-export')?.addEventListener('click', exportData);
    document.getElementById('btn-import')?.addEventListener('click', importData);
    document.getElementById('btn-reset')?.addEventListener('click', resetData);
  }

  function activateProvider(id) {
    const providers = DB.getAll('ai_providers');
    providers.forEach(p => {
      DB.update('ai_providers', p.id, { is_active: p.id === id });
    });
    renderProviders();
  }

  function testProvider(id) {
    const p = DB.getById('ai_providers', id);
    alert('Probar conexion con ' + (p ? p.name : 'proveedor') + '\n(Pendiente: implementar prueba real)');
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('bitacora_theme', next);
    renderAppearance();
  }

  function setAccent(color) {
    document.documentElement.style.setProperty('--green', color);
    document.documentElement.style.setProperty('--accent-green', color);
    localStorage.setItem('bitacora_accent', color);
  }

  function exportData() {
    const data = DB.exportAll();
    data.version = 1;
    data.exported_at = new Date().toISOString();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bitacora-export-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (confirm('Importar ' + Object.keys(data).length + ' tablas? Se sobrescribiran los datos actuales.')) {
            DB.importAll(data);
            alert('Datos importados correctamente');
            App.updateProgress();
          }
        } catch (err) { alert('Error al importar: ' + err.message); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function resetData() {
    const confirmInput = prompt('Escribe ELIMINAR para confirmar:');
    if (confirmInput === 'ELIMINAR') {
      DB.reset();
      alert('Todos los datos han sido eliminados');
      window.location.reload();
    }
  }

  function bindEvents() {}

  return { init, render };
})();
