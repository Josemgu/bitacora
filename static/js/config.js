const Config = (() => {
  'use strict';

  function init() { bindEvents(); }

  function render() {
    renderProviders();
    renderAppearance();
    renderActions();
  }

  async function renderProviders() {
    const container = document.getElementById('config-providers');
    if (!container) return;
    let providers = [];
    try { providers = await API.getAIProviders(); } catch (e) { console.error('[Config]', e); }

    const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

    container.innerHTML = providers.map(p => `
      <div class="panel" style="margin-bottom:10px">
        <div class="panel-body">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <strong>${esc(p.name)}</strong>
            <span>
              ${p.has_api_key ? '<span class="tag">&#128273; clave guardada</span>' : ''}
              <span class="tag${p.is_active ? ' tag-green' : ''}">${p.is_active ? 'Activo' : 'Inactivo'}</span>
            </span>
          </div>
          <div style="font-size:12px;color:var(--muted)">
            <div>Endpoint: ${esc(p.endpoint || '(por defecto)')}</div>
            <div>Modelo: ${esc(p.default_model || '(por defecto)')}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" data-action="activate" data-id="${p.id}">Activar</button>
            <button class="btn btn-ghost btn-sm" data-action="key" data-id="${p.id}">Guardar clave</button>
            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${p.id}">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('') + `
      <div class="panel" style="margin-top:14px">
        <div class="panel-body">
          <strong style="display:block;margin-bottom:10px">Agregar proveedor</strong>
          <div style="display:flex;flex-direction:column;gap:8px">
            <select id="new-prov-preset" class="select">
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="ollama">Ollama (local, sin clave)</option>
            </select>
            <input id="new-prov-model" class="input" placeholder="Modelo (ej. claude-sonnet-5 / gpt-4o-mini / llama3)">
            <input id="new-prov-key" class="input" type="password" placeholder="Clave API (se guarda cifrada en el servidor)">
            <button class="btn btn-primary btn-sm" id="btn-add-provider">Agregar</button>
          </div>
        </div>
      </div>`;

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        if (action === 'activate') activateProvider(id);
        else if (action === 'key') saveProviderKey(id);
        else if (action === 'delete') deleteProvider(id);
      });
    });

    document.getElementById('btn-add-provider')?.addEventListener('click', addProvider);
  }

  const PROVIDER_PRESETS = {
    anthropic: { name: 'Anthropic', slug: 'anthropic', endpoint: 'https://api.anthropic.com', default_model: 'claude-sonnet-5', is_local: false },
    openai:    { name: 'OpenAI',    slug: 'openai',    endpoint: 'https://api.openai.com/v1', default_model: 'gpt-4o-mini', is_local: false },
    ollama:    { name: 'Ollama',    slug: 'ollama',    endpoint: 'http://localhost:11434/v1', default_model: 'llama3', is_local: true }
  };

  async function addProvider() {
    const preset = PROVIDER_PRESETS[document.getElementById('new-prov-preset').value];
    const model = document.getElementById('new-prov-model').value.trim();
    const key = document.getElementById('new-prov-key').value.trim();
    try {
      const payload = { ...preset };
      if (model) payload.default_model = model;
      if (key) payload.api_key = key;
      // slug único por si se repite
      payload.slug = payload.slug + '-' + Date.now().toString(36);
      const created = await API.createAIProvider(payload);
      await API.setActiveAIProvider(created.id);
      await renderProviders();
    } catch (err) {
      alert('No se pudo agregar: ' + (err.message || 'error'));
    }
  }

  async function saveProviderKey(id) {
    const key = prompt('Pega la clave API (se guardara cifrada en el servidor):');
    if (!key) return;
    try {
      await API.request('/providers/' + id, { method: 'PATCH', body: { api_key: key.trim() } });
      alert('Clave guardada cifrada.');
      await renderProviders();
    } catch (err) {
      alert('Error: ' + (err.message || 'no se pudo guardar'));
    }
  }

  async function deleteProvider(id) {
    if (!confirm('Eliminar este proveedor?')) return;
    try {
      await API.deleteAIProvider(id);
      await renderProviders();
    } catch (err) {
      alert('Error: ' + (err.message || 'no se pudo eliminar'));
    }
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

  async function activateProvider(id) {
    try {
      await API.setActiveAIProvider(id);
      await renderProviders();
    } catch (err) {
      alert('Error al activar: ' + (err.message || 'error'));
    }
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
