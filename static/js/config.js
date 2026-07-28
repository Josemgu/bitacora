/**
 * config.js — F9: Panel de configuracion.
 * Namespace global: Config
 * Dependencias: DB (js/db.js), AIChat (js/ai-chat.js), Encryption (js/encryption.js)
 *
 * Secciones:
 *   9a. Proveedores de IA
 *   9b. Botones de accion
 *   9c. Exportar / Importar
 *   9d. Zona de peligro
 *   9e. Apariencia
 */
const Config = (() => {
  'use strict';

  /* ═════════════════════════════  ESTADO  ═════════════════════════════ */

  const state = {
    providers: [],     // Lista de proveedores de IA
    editingId: null,   // ID del proveedor en edicion (null = nuevo)
    importData: null,  // Datos pendientes de importar
    importDiff: null   // Diff calculado para importacion
  };

  /* Cache DOM */
  let $container = null;

  /* ═════════════════════════════  CONSTANTES  ═════════════════════════════ */

  const ACCENT_COLORS = [
    { hex: '#3fb950', name: 'Verde' },
    { hex: '#58a6ff', name: 'Azul' },
    { hex: '#a371f7', name: 'Purpura' },
    { hex: '#f85149', name: 'Rojo' },
    { hex: '#39c5cf', name: 'Cyan' },
    { hex: '#d29922', name: 'Naranja' }
  ];

  const PROVIDER_TEMPLATES = {
    openai: {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      env_key_name: '$OPENAI_API_KEY',
      active: true,
      mode: 'cloud'
    },
    anthropic: {
      name: 'Anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307',
      env_key_name: '$ANTHROPIC_API_KEY',
      active: true,
      mode: 'cloud'
    },
    google: {
      name: 'Google',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-1.5-flash',
      env_key_name: '$GOOGLE_API_KEY',
      active: true,
      mode: 'cloud'
    },
    ollama: {
      name: 'Ollama',
      endpoint: 'http://localhost:11434/api/chat',
      model: 'llama3.2',
      env_key_name: '',
      active: true,
      mode: 'local'
    },
    custom: {
      name: '',
      endpoint: '',
      model: '',
      env_key_name: '',
      active: true,
      mode: 'cloud'
    }
  };

  /* Tablas requeridas para importacion */
  const REQUIRED_TABLES = ['phases', 'topics', 'resources', 'ai_providers'];

  /* ═════════════════════════════  UTILIDADES  ═════════════════════════════ */

  const esc = (str) => {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  };

  const nowISO = () => new Date().toISOString();

  /** Normaliza un registro de proveedor para soportar tanto campos viejos como nuevos. */
  function normalizeProvider(provider) {
    if (!provider || typeof provider !== 'object') return provider;

    const normalized = { ...provider };
    normalized.name = normalized.name || 'Proveedor';
    normalized.model = normalized.model || normalized.default_model || 'gpt-4o-mini';
    normalized.default_model = normalized.default_model || normalized.model || 'gpt-4o-mini';
    normalized.endpoint = normalized.endpoint || normalized.base_url || normalized.url || '';
    normalized.base_url = normalized.base_url || normalized.endpoint || '';
    normalized.active = normalized.active ?? normalized.is_active ?? true;
    normalized.is_active = normalized.is_active ?? normalized.active ?? true;
    normalized.mode = normalized.mode || (normalized.is_local ? 'local' : 'cloud');
    normalized.is_local = normalized.is_local ?? (normalized.mode === 'local');
    return normalized;
  }

  /** Formatea fecha para nombre de archivo: YYYY-MM-DD */
  const fmtDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  /* ═════════════════════════════  INICIALIZACION  ═════════════════════════════ */

  /** Inicializa la vista de configuracion. */
  function init() {
    const section = document.getElementById('view-config') || document.getElementById('config-view');
    if (!section) {
      console.warn('[Config] No se encontro la vista de configuracion');
      return;
    }

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'openrouter-callback') {
        const payload = event.data.payload || {};
        const warning = 'Advertencia de gasto: OpenRouter puede cobrar segun el uso de tokens y tu plan. Revisa el presupuesto antes de seguir.';
        if (payload.ok) {
          alert(warning);
        }
      }
    });

    // Reemplazar el contenido estatico de la vista por el panel dinamico.
    const body = section.querySelector('.view-body') || section;
    if (body) {
      const existingMount = document.getElementById('config-view');
      if (existingMount) {
        existingMount.remove();
      }

      const mount = document.createElement('div');
      mount.id = 'config-view';
      mount.style.width = '100%';
      body.innerHTML = '';
      body.appendChild(mount);
      $container = mount;
    } else {
      $container = section;
    }

    render();
  }

  /** Renderiza todo el panel de configuracion. */
  function render() {
    if (!$container) return;
    $container.innerHTML = `
      <div style="max-width:960px;margin:0 auto;padding:1rem;display:flex;flex-direction:column;gap:2rem;">
        <h2 style="margin:0;font-size:1.5rem;color:#e2e8f0;">Configuracion</h2>

        <!-- 9a. Proveedores de IA -->
        <section id="cfg-providers-section">
          <h3 style="font-size:1.125rem;color:#e2e8f0;margin-bottom:0.75rem;">Proveedores de IA</h3>
          <div id="cfg-provider-connection"></div>
          <div id="cfg-providers-list"></div>
          <div id="cfg-provider-form-wrap" style="margin-top:1rem;display:none;"></div>
        </section>

        <!-- 9b. Apariencia -->
        <section id="cfg-appearance-section" style="padding-top:1rem;border-top:1px solid #334155;">
          <h3 style="font-size:1.125rem;color:#e2e8f0;margin-bottom:0.75rem;">Apariencia</h3>
          <div id="cfg-appearance" style="display:flex;flex-direction:column;gap:1rem;"></div>
        </section>

        <!-- 9c. Botones de accion -->
        <section id="cfg-actions-section" style="padding-top:1rem;border-top:1px solid #334155;">
          <h3 style="font-size:1.125rem;color:#e2e8f0;margin-bottom:0.75rem;">Acciones</h3>
          <div id="cfg-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;"></div>
        </section>

        <!-- 9d. Exportar / Importar -->
        <section id="cfg-data-section" style="padding-top:1rem;border-top:1px solid #334155;">
          <h3 style="font-size:1.125rem;color:#e2e8f0;margin-bottom:0.75rem;">Datos</h3>
          <div id="cfg-data-actions" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;"></div>
          <div id="cfg-import-preview" style="margin-top:1rem;display:none;"></div>
        </section>

        <!-- 9e. Zona de peligro -->
        <section id="cfg-danger-section" style="padding-top:1rem;border-top:1px solid #334155;">
          <h3 style="font-size:1.125rem;color:#ef4444;margin-bottom:0.75rem;">Zona de peligro</h3>
          <div id="cfg-danger"></div>
        </section>
      </div>
    `;

    renderProviders();
    renderAppearance();
    renderActionButtons();
    renderDataActions();
    renderDangerZone();
  }

  /* ═════════════════════════════  9a. PROVEEDORES DE IA  ═════════════════════════════ */

  /** Muestra la lista de proveedores configurados. */
  function renderProviders() {
    const $wrap = document.getElementById('cfg-providers-list');
    const $connection = document.getElementById('cfg-provider-connection');
    if (!$wrap) return;

    state.providers = (DB.getAll('ai_providers') || []).map(normalizeProvider);

    if ($connection) {
      $connection.innerHTML = `
        <div class="panel" style="padding:1rem;margin-bottom:1rem;border:1px solid #334155;">
          <h4 style="margin:0 0 0.5rem;font-size:1rem;color:#e2e8f0;">Conectar proveedor</h4>
          <p style="margin:0 0 0.75rem;color:#94a3b8;font-size:0.875rem;">
            Ollama es la opcion recomendada para empezar. OpenRouter solo se usa a traves del flujo oficial de autorizacion y puede generar gastos.
          </p>
          <div style="display:flex;flex-direction:column;gap:0.5rem;">
            <button id="cfg-connect-ollama" class="btn btn-primary" type="button">Conectar Ollama</button>
            <button id="cfg-connect-openrouter" class="btn btn-ghost" type="button">Conectar OpenRouter</button>
            <button id="cfg-manual-key" class="btn btn-ghost" type="button">Ingresar clave manualmente</button>
          </div>
        </div>
      `;
      document.getElementById('cfg-connect-ollama')?.addEventListener('click', () => {
        showAddProvider();
        const nameInput = document.getElementById('cfg-name');
        if (nameInput) nameInput.value = 'Ollama';
        const endpointInput = document.getElementById('cfg-endpoint');
        if (endpointInput) endpointInput.value = 'http://localhost:11434/api/chat';
        const modelInput = document.getElementById('cfg-model');
        if (modelInput) modelInput.value = 'llama3.2';
        const modeRadios = document.querySelectorAll('input[name="cfg-mode"]');
        modeRadios.forEach(r => { if (r.value === 'local') r.checked = true; });
        _toggleApiKeyField('local');
      });
      document.getElementById('cfg-connect-openrouter')?.addEventListener('click', async () => {
        const warning = await ProviderConnection.buildOpenRouterConnectionWarning({ name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions' });
        if (!window.confirm(`${warning}\n\nContinuar con la conexion oficial de OpenRouter?`)) return;
        try {
          await ProviderConnection.startOpenRouterFlow({ provider: { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions' } });
        } catch (err) {
          alert(err.message);
        }
      });
      document.getElementById('cfg-manual-key')?.addEventListener('click', () => {
        showAddProvider();
        const nameInput = document.getElementById('cfg-name');
        if (nameInput) nameInput.value = 'Proveedor manual';
        const endpointInput = document.getElementById('cfg-endpoint');
        if (endpointInput) endpointInput.value = 'https://api.example.com/v1/chat/completions';
        const modeRadios = document.querySelectorAll('input[name="cfg-mode"]');
        modeRadios.forEach(r => { if (r.value === 'cloud') r.checked = true; });
        _toggleApiKeyField('cloud');
      });
    }

    if (state.providers.length === 0) {
      $wrap.innerHTML = `
        <div class="panel" style="padding:1rem;text-align:center;color:#64748b;">
          <p>No hay proveedores configurados.</p>
          <button id="cfg-add-first" class="btn btn-primary" style="margin-top:0.5rem;">Anadir proveedor</button>
        </div>
      `;
      document.getElementById('cfg-add-first')?.addEventListener('click', () => showAddProvider());
      return;
    }

    let html = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
    state.providers.forEach(p => {
      const statusClass = p.active !== false ? 'tag tag-green' : 'tag';
      const statusLabel = p.active !== false ? 'Activo' : 'Inactivo';
      const endpoint = p.endpoint || '-';
      const model = p.model || '-';
      // Mode badge: cloud (nube) or local (servidor local)
      const mode = p.mode || (p.is_local ? 'local' : 'cloud');
      const modeClass = mode === 'local' ? 'tag tag-purple' : 'tag tag-blue';
      const modeLabel = mode === 'local' ? 'Local' : 'Nube';

      html += `
        <div class="panel" style="padding:0.75rem 1rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;" data-provider-id="${esc(p.id)}">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:600;color:#e2e8f0;">${esc(p.name)}</div>
            <div style="font-size:0.8125rem;color:#64748b;margin-top:0.25rem;">
              <span class="${statusClass}">${statusLabel}</span>
              <span class="${modeClass}" style="margin-left:0.5rem;">${modeLabel}</span>
              <span style="margin-left:0.5rem;">${esc(endpoint)}</span>
              <span style="margin-left:0.5rem;color:#475569;">| ${esc(model)}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.5rem;">
            <button class="btn btn-sm btn-ghost cfg-test-btn" data-id="${esc(p.id)}" title="Probar conexion">Probar</button>
            <button class="btn btn-sm btn-ghost cfg-edit-btn" data-id="${esc(p.id)}">Editar</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    html += `<button id="cfg-add-provider" class="btn btn-primary" style="margin-top:0.75rem;">+ Anadir proveedor</button>`;

    $wrap.innerHTML = html;

    // Eventos
    $wrap.querySelectorAll('.cfg-test-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Probando...';
        const result = await AIChat.testConnection(id);
        btn.disabled = false;
        btn.textContent = 'Probar';
        if (result.ok) {
          btn.textContent = `${result.latencyMs}ms`;
          setTimeout(() => { btn.textContent = 'Probar'; }, 3000);
        } else {
          alert(`Error: ${result.error}`);
        }
      });
    });

    $wrap.querySelectorAll('.cfg-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => _showEditProvider(Number(btn.dataset.id)));
    });

    document.getElementById('cfg-add-provider')?.addEventListener('click', () => showAddProvider());
  }

  /**
   * Muestra el formulario para anadir o editar un proveedor.
   * @param {Object|null} provider — Proveedor a editar, o null para nuevo
   * @private
   */
  function _renderProviderForm(provider = null) {
    const $wrap = document.getElementById('cfg-provider-form-wrap');
    if (!$wrap) return;

    const draftKey = 'bitacora_provider_form_draft';
    const draft = sessionStorage.getItem(draftKey);
    let draftData = null;
    try { draftData = draft ? JSON.parse(draft) : null; } catch (err) { draftData = null; }

    state.editingId = provider ? provider.id : null;
    const isEdit = !!provider;
    const p = normalizeProvider(provider || {});

    // Determine current mode: 'cloud' or 'local'
    const currentMode = p.mode || (p.is_local ? 'local' : 'cloud');
    const draftName = draftData && draftData.name ? draftData.name : (p.name || '');
    const draftEndpoint = draftData && draftData.endpoint ? draftData.endpoint : (p.endpoint || '');
    const draftModel = draftData && draftData.model ? draftData.model : (p.model || '');
    const draftEnvKey = draftData && draftData.env_key_name ? draftData.env_key_name : (p.env_key_name || '');
    const draftActive = draftData && typeof draftData.active === 'boolean' ? draftData.active : (p.active !== false);
    const draftMode = draftData && draftData.mode ? draftData.mode : currentMode;

    $wrap.style.display = 'block';
    $wrap.innerHTML = `
      <div class="panel" style="padding:1rem;">
        <h4 style="margin:0 0 0.75rem;font-size:1rem;color:#e2e8f0;">${isEdit ? 'Editar' : 'Nuevo'} proveedor</h4>

        ${!isEdit ? `
        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Plantilla</label>
          <select id="cfg-tmpl" class="select" style="width:100%;">
            <option value="">-- Personalizado --</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="ollama">Ollama (local)</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        ` : ''}

        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Nombre</label>
          <input id="cfg-name" class="input" value="${esc(draftName)}" placeholder="Ej: OpenAI" style="width:100%;">
        </div>

        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Modo</label>
          <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:0.375rem;cursor:pointer;">
              <input type="radio" name="cfg-mode" value="cloud" ${draftMode === 'cloud' ? 'checked' : ''}>
              <span>Nube (Cloud)</span>
            </label>
            <label style="display:flex;align-items:center;gap:0.375rem;cursor:pointer;">
              <input type="radio" name="cfg-mode" value="local" ${draftMode === 'local' ? 'checked' : ''}>
              <span>Local (Ollama, etc.)</span>
            </label>
          </div>
          <p class="panel-note" style="margin-top:0.5rem;font-size:0.75rem;color:#64748b;">
            <strong>Nube:</strong> Requiere API Key (se cifra en el navegador).<br>
            <strong>Local:</strong> No requiere API Key (ej. Ollama en localhost).
          </p>
        </div>

        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Endpoint</label>
          <input id="cfg-endpoint" class="input" value="${esc(draftEndpoint)}" placeholder="https://api.openai.com/v1/chat/completions" style="width:100%;">
        </div>

        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Modelo por defecto</label>
          <input id="cfg-model" class="input" value="${esc(draftModel)}" placeholder="gpt-4o-mini" style="width:100%;">
        </div>

        <div class="field" id="cfg-api-key-field" style="margin-bottom:0.75rem;${draftMode === 'local' ? 'display:none;' : ''}">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">API Key</label>
          <div style="display:flex;gap:0.5rem;">
            <input id="cfg-api-key" class="input" type="password" value="" placeholder="Ingresa tu API key (se cifra localmente)" style="flex:1;">
            <button id="cfg-toggle-key" class="btn btn-ghost btn-sm" type="button" title="Mostrar/ocultar">
              <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <p class="panel-note" style="margin-top:0.25rem;font-size:0.75rem;color:#64748b;">
            La clave se cifra en el navegador (AES-GCM 256-bit) antes de guardarse.
            <span id="cfg-key-status" style="margin-left:0.5rem;"></span>
          </p>
        </div>

        <div class="field" style="margin-bottom:0.75rem;">
          <label class="label" style="font-size:0.875rem;color:#94a3b8;">Variable de entorno (opcional)</label>
          <input id="cfg-env-key" class="input" value="${esc(draftEnvKey)}" placeholder="\$OPENAI_API_KEY" style="width:100%;">
          <p class="panel-note" style="margin-top:0.25rem;font-size:0.75rem;color:#64748b;">Si se define, la app intentara leer la clave desde process.env en el servidor.</p>
        </div>

        <div class="field" style="margin-bottom:0.75rem;">
          <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
            <input id="cfg-active" type="checkbox" ${draftActive ? 'checked' : ''}>
            <span style="font-size:0.875rem;color:#94a3b8;">Activo</span>
          </label>
        </div>

        <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
          <button id="cfg-cancel" class="btn btn-ghost btn-sm">${isEdit ? 'Cancelar' : 'Cerrar'}</button>
          <button id="cfg-save" class="btn btn-primary btn-sm">Guardar</button>
        </div>
      </div>
    `;

    // Template selector
    const $tmpl = document.getElementById('cfg-tmpl');
    if ($tmpl) {
      $tmpl.addEventListener('change', () => {
        const tpl = PROVIDER_TEMPLATES[$tmpl.value];
        if (tpl) {
          document.getElementById('cfg-name').value = tpl.name;
          document.getElementById('cfg-endpoint').value = tpl.endpoint;
          document.getElementById('cfg-model').value = tpl.model;
          document.getElementById('cfg-env-key').value = tpl.env_key_name;
          // Set mode based on template
          const modeRadios = document.querySelectorAll('input[name="cfg-mode"]');
          modeRadios.forEach(r => r.checked = r.value === tpl.mode);
          // Toggle API key field visibility
          _toggleApiKeyField(tpl.mode);
        }
      });
    }

    // Mode radio buttons - toggle API key field
    document.querySelectorAll('input[name="cfg-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        _toggleApiKeyField(e.target.value);
      });
    });

    // Toggle API key visibility
    document.getElementById('cfg-toggle-key')?.addEventListener('click', () => {
      const $input = document.getElementById('cfg-api-key');
      if ($input) {
        $input.type = $input.type === 'password' ? 'text' : 'password';
      }
    });

    // If editing, load existing API key (decrypted)
    if (isEdit && p.api_key_encrypted) {
      _loadDecryptedKey(p.id);
    }

    // Cancel button
    document.getElementById('cfg-cancel')?.addEventListener('click', () => {
      $wrap.style.display = 'none';
      $wrap.innerHTML = '';
      state.editingId = null;
    });

    // Save button
    document.getElementById('cfg-save')?.addEventListener('click', () => _saveProvider());

    const draftInputs = ['cfg-name', 'cfg-endpoint', 'cfg-model', 'cfg-env-key'];
    draftInputs.forEach((id) => {
      const input = document.getElementById(id);
      input?.addEventListener('input', () => {
        sessionStorage.setItem(draftKey, JSON.stringify({
          name: document.getElementById('cfg-name')?.value || '',
          endpoint: document.getElementById('cfg-endpoint')?.value || '',
          model: document.getElementById('cfg-model')?.value || '',
          env_key_name: document.getElementById('cfg-env-key')?.value || '',
          active: document.getElementById('cfg-active')?.checked !== false,
          mode: document.querySelector('input[name="cfg-mode"]:checked')?.value || 'cloud'
        }));
      });
    });
    document.querySelectorAll('input[name="cfg-mode"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        sessionStorage.setItem(draftKey, JSON.stringify({
          name: document.getElementById('cfg-name')?.value || '',
          endpoint: document.getElementById('cfg-endpoint')?.value || '',
          model: document.getElementById('cfg-model')?.value || '',
          env_key_name: document.getElementById('cfg-env-key')?.value || '',
          active: document.getElementById('cfg-active')?.checked !== false,
          mode: document.querySelector('input[name="cfg-mode"]:checked')?.value || 'cloud'
        }));
      });
    });
    document.getElementById('cfg-active')?.addEventListener('change', () => {
      sessionStorage.setItem(draftKey, JSON.stringify({
        name: document.getElementById('cfg-name')?.value || '',
        endpoint: document.getElementById('cfg-endpoint')?.value || '',
        model: document.getElementById('cfg-model')?.value || '',
        env_key_name: document.getElementById('cfg-env-key')?.value || '',
        active: document.getElementById('cfg-active')?.checked !== false,
        mode: document.querySelector('input[name="cfg-mode"]:checked')?.value || 'cloud'
      }));
    });
  }

  /** Toggle API key field visibility based on mode. @private */
  function _toggleApiKeyField(mode) {
    const $field = document.getElementById('cfg-api-key-field');
    const $status = document.getElementById('cfg-key-status');
    if ($field) {
      $field.style.display = mode === 'local' ? 'none' : 'block';
    }
    if ($status) {
      $status.textContent = mode === 'local' ? '(No requerido en modo local)' : '';
    }
  }

  /** Load and decrypt existing API key for editing. @private */
  async function _loadDecryptedKey(providerId) {
    const $input = document.getElementById('cfg-api-key');
    const $status = document.getElementById('cfg-key-status');
    if (!$input) return;

    try {
      const provider = DB.getById('ai_providers', providerId);
      if (provider && provider.api_key_encrypted) {
        const decrypted = await Encryption.decrypt(provider.api_key_encrypted);
        $input.value = decrypted;
        if ($status) {
          $status.textContent = 'Clave cargada (cifrada en BD)';
          $status.style.color = '#3fb950';
        }
      }
    } catch (err) {
            console.error('[Config] Error decrypting key:', err.message);
      if ($status) {
        $status.textContent = 'Error al descifrar la clave';
        $status.style.color = '#f85149';
      }
    }
  }

  /** Save provider (create or update). @private */
  async function _saveProvider() {
    const name = document.getElementById('cfg-name')?.value?.trim();
    const endpoint = document.getElementById('cfg-endpoint')?.value?.trim();
    const model = document.getElementById('cfg-model')?.value?.trim();
    const envKeyName = document.getElementById('cfg-env-key')?.value?.trim();
    const active = document.getElementById('cfg-active')?.checked !== false;
    const mode = document.querySelector('input[name="cfg-mode"]:checked')?.value || 'cloud';
    const apiKey = document.getElementById('cfg-api-key')?.value || '';

    if (!name || !endpoint || !model) {
      alert('Nombre, endpoint y modelo son obligatorios.');
      return;
    }

    if (mode === 'cloud' && !apiKey && !state.editingId) {
      alert('La API Key es obligatoria para proveedores en modo Nube.');
      return;
    }

    const data = {
      name,
      endpoint,
      model,
      default_model: model,
      env_key_name: envKeyName,
      active,
      is_active: active,
      mode,
      is_local: mode === 'local',
      updated_at: nowISO()
    };

    // Encrypt API key if provided and mode is cloud
    if (mode === 'cloud' && apiKey) {
      try {
        data.api_key_encrypted = await Encryption.encrypt(apiKey);
      } catch (err) {
                console.error('[Config] Error encrypting key:', err.message);
        alert('Error al cifrar la API Key: ' + err.message);
        return;
      }
    } else if (mode === 'local') {
      // Ensure no encrypted key is stored for local providers
      data.api_key_encrypted = null;
    }

    try {
      if (state.editingId) {
        DB.update('ai_providers', state.editingId, data);
      } else {
        data.created_at = nowISO();
        DB.insert('ai_providers', data);
      }

      // Refresh
      const $wrap = document.getElementById('cfg-provider-form-wrap');
      if ($wrap) {
        $wrap.style.display = 'none';
        $wrap.innerHTML = '';
      }
      state.editingId = null;
      renderProviders();
      await AIChat.loadProviders();
      AIChat.renderProviderSelector();
    } catch (err) {
      console.error('[Config] Error saving provider:', err);
      alert('Error al guardar: ' + err.message);
    }
  }

  /** Muestra formulario para nuevo proveedor. */
  function showAddProvider() {
    _renderProviderForm(null);
  }

  /** Muestra formulario para editar proveedor existente. @private */
  function _showEditProvider(id) {
    const provider = DB.getById('ai_providers', id);
    if (provider) {
      _renderProviderForm(provider);
    }
  }

  /* ═════════════════════════════  9b. BOTONES DE ACCION  ═════════════════════════════ */

  /** Renderiza los botones de accion (probar todos, activar/desactivar). */
  function renderActionButtons() {
    const $wrap = document.getElementById('cfg-actions');
    if (!$wrap) return;

    $wrap.innerHTML = `
      <button id="cfg-test-all" class="btn btn-primary" style="flex:1;">
        <svg class="ico"><use href="#i-play"></use></svg>Probar todos
      </button>
      <button id="cfg-activate-first" class="btn btn-ghost" style="flex:1;">
        <svg class="ico"><use href="#i-check"></use></svg>Activar primero
      </button>
    `;

    document.getElementById('cfg-test-all')?.addEventListener('click', async () => {
      const providers = DB.getAll('ai_providers');
      if (providers.length === 0) {
        alert('No hay proveedores configurados.');
        return;
      }

      const $btn = document.getElementById('cfg-test-all');
      $btn.disabled = true;
      $btn.textContent = 'Probando...';

      const results = [];
      for (const p of providers) {
        const result = await AIChat.testConnection(p.id);
        results.push({ name: p.name, ...result });
      }

      $btn.disabled = false;
      $btn.textContent = 'Probar todos';

      const msg = results.map(r => `${r.name}: ${r.ok ? 'OK (' + r.latencyMs + 'ms)' : 'Error - ' + r.error}`).join('\n');
      alert(msg);
    });

    document.getElementById('cfg-activate-first')?.addEventListener('click', () => {
      const providers = DB.getAll('ai_providers');
      if (providers.length === 0) return;
      providers.forEach((p, i) => {
        DB.update('ai_providers', p.id, { active: i === 0 });
      });
      renderProviders();
    });
  }

  /* ═════════════════════════════  9c. EXPORTAR / IMPORTAR  ═════════════════════════════ */

  /** Renderiza botones de exportar/importar. */
  function renderDataActions() {
    const $wrap = document.getElementById('cfg-data-actions');
    if (!$wrap) return;

    $wrap.innerHTML = `
      <button id="cfg-export" class="btn btn-primary">
        <svg class="ico"><use href="#i-download"></use></svg>Exportar datos
      </button>
      <label class="btn btn-ghost" style="cursor:pointer;">
        <svg class="ico"><use href="#i-upload"></use></svg>Importar datos
        <input type="file" id="cfg-import-file" accept=".json" style="display:none;">
      </label>
    `;

    document.getElementById('cfg-export')?.addEventListener('click', exportData);
    document.getElementById('cfg-import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) importData(file);
      e.target.value = '';
    });
  }

  /** Exporta todos los datos a un archivo JSON. */
  function exportData() {
    const data = DB.exportAll();
    data.version = 1;
    data.exported_at = new Date().toISOString();

    // Sanitize: remove encrypted API keys from export for security
    const safeData = JSON.parse(JSON.stringify(data));
    if (safeData.ai_providers) {
      safeData.ai_providers = safeData.ai_providers.map(p => {
        const { api_key_encrypted, ...rest } = p;
        return rest;
      });
    }

    const blob = new Blob([JSON.stringify(safeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora-export-${fmtDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Importa datos desde un archivo JSON.
   * @param {File} file — Archivo JSON seleccionado
   */
  function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Validar que tenga las tablas necesarias
        const hasRequired = REQUIRED_TABLES.some(t => data.hasOwnProperty(t) && Array.isArray(data[t]));
        if (!hasRequired) {
          alert('El archivo no contiene datos validos de Bitacora. Faltan tablas requeridas.');
          return;
        }

        // Calcular diff
        const diff = _calculateDiff(data);
        state.importData = data;
        state.importDiff = diff;

        // Mostrar preview
        _renderImportPreview(diff);
      } catch (err) {
        alert('Error leyendo el archivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Calcula el diff entre datos importados y los actuales.
   * @private
   */
  function _calculateDiff(imported) {
    const diff = {};
    for (const table of Object.keys(imported)) {
      if (!Array.isArray(imported[table])) continue;
      const existing = DB.getAll(table);
      const existingIds = new Set(existing.map(r => r.id));
      const existingSignatures = new Set(existing.map(_recordSignature));

      let newCount = 0;
      let updatedCount = 0;

      for (const record of imported[table]) {
        if (!record.id) {
          newCount++;
          continue;
        }
        if (!existingIds.has(record.id)) {
          newCount++;
        } else if (!existingSignatures.has(_recordSignature(record))) {
          updatedCount++;
        }
      }

      if (newCount > 0 || updatedCount > 0) {
        diff[table] = { new: newCount, updated: updatedCount };
      }
    }
    return diff;
  }

  /** Genera una firma simple de un registro para comparar cambios. @private */
  function _recordSignature(r) {
    const { id, created_at, updated_at, ...rest } = r;
    return JSON.stringify(rest);
  }

  /** Renderiza el preview de importacion con boton de confirmacion. @private */
  function _renderImportPreview(diff) {
    const $wrap = document.getElementById('cfg-import-preview');
    if (!$wrap) return;

    const tables = Object.keys(diff);
    if (tables.length === 0) {
      $wrap.innerHTML = '<div class="panel" style="padding:1rem;color:#64748b;">No hay cambios para importar.</div>';
      $wrap.style.display = 'block';
      return;
    }

    let summaryHtml = '';
    let totalNew = 0;
    let totalUpdated = 0;
    for (const t of tables) {
      const d = diff[t];
      totalNew += d.new;
      totalUpdated += d.updated;
      summaryHtml += `<li style="margin-bottom:0.25rem;"><strong>${esc(t)}</strong>: ${d.new > 0 ? d.new + ' nuevos' : ''}${d.new > 0 && d.updated > 0 ? ', ' : ''}${d.updated > 0 ? d.updated + ' actualizados' : ''}</li>`;
    }

    $wrap.style.display = 'block';
    $wrap.innerHTML = `
      <div class="panel" style="padding:1rem;">
        <h4 style="margin:0 0 0.5rem;font-size:1rem;color:#e2e8f0;">Resumen de importacion</h4>
        <p style="margin:0 0 0.5rem;color:#94a3b8;font-size:0.875rem;">
          ${totalNew} registros nuevos, ${totalUpdated} actualizados:
        </p>
        <ul style="color:#cbd5e1;font-size:0.875rem;margin:0 0 1rem;padding-left:1.25rem;">
          ${summaryHtml}
        </ul>
        <div style="display:flex;gap:0.5rem;">
          <button id="cfg-import-confirm" class="btn btn-primary">Confirmar importacion</button>
          <button id="cfg-import-cancel" class="btn btn-ghost">Cancelar</button>
        </div>
      </div>
    `;

    document.getElementById('cfg-import-confirm')?.addEventListener('click', async () => {
      if (!state.importData) return;
      const ok = DB.importAll(state.importData);
      if (ok) {
        alert('Importacion completada exitosamente.');
        state.importData = null;
        state.importDiff = null;
        $wrap.style.display = 'none';
        $wrap.innerHTML = '';
        // Recargar datos en UI
        renderProviders();
        await AIChat.loadProviders();
        AIChat.renderProviderSelector();
      } else {
        alert('Error al importar los datos.');
      }
    });

    document.getElementById('cfg-import-cancel')?.addEventListener('click', () => {
      state.importData = null;
      state.importDiff = null;
      $wrap.style.display = 'none';
      $wrap.innerHTML = '';
    });
  }

  /* ═════════════════════════════  9d. ZONA DE PELIGRO  ═════════════════════════════ */

  /** Renderiza el panel de zona de peligro. */
  function renderDangerZone() {
    const $wrap = document.getElementById('cfg-danger');
    if (!$wrap) return;

    $wrap.innerHTML = `
      <div class="panel" style="padding:1rem;border:1px solid #ef4444;">
        <p style="margin:0 0 0.75rem;color:#fca5a5;font-size:0.875rem;">
          Elimina TODOS los datos y vuelve al estado inicial. Esta accion no se puede deshacer.
        </p>
        <button id="cfg-delete-all" class="btn btn-danger">Eliminar todo</button>

        <div id="cfg-delete-modal" style="display:none;margin-top:1rem;padding:1rem;background:#1e293b;border-radius:0.5rem;">
          <p style="margin:0 0 0.75rem;color:#fca5a5;font-size:0.875rem;">
            Para confirmar, escribe <strong>ELIMINAR</strong> a continuacion. Se recomienda exportar los datos antes.
          </p>
          <input id="cfg-delete-confirm-input" class="input" placeholder="Escribe ELIMINAR" style="width:100%;margin-bottom:0.75rem;">
          <div style="display:flex;gap:0.5rem;">
            <button id="cfg-delete-confirm-btn" class="btn btn-danger" disabled>Si, eliminar todo</button>
            <button id="cfg-delete-cancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('cfg-delete-all')?.addEventListener('click', () => {
      const $modal = document.getElementById('cfg-delete-modal');
      if ($modal) $modal.style.display = 'block';
    });

    document.getElementById('cfg-delete-cancel')?.addEventListener('click', () => {
      _closeDeleteModal();
    });

    document.getElementById('cfg-delete-confirm-input')?.addEventListener('input', (e) => {
      const btn = document.getElementById('cfg-delete-confirm-btn');
      if (btn) btn.disabled = e.target.value !== 'ELIMINAR';
    });

    document.getElementById('cfg-delete-confirm-btn')?.addEventListener('click', () => {
      const input = document.getElementById('cfg-delete-confirm-input');
      if (!input || input.value !== 'ELIMINAR') return;

      try {
        DB.reset();
        // Limpiar historial de chat tambien
        localStorage.removeItem('bitacora_ai_chat_history');
        alert('Todos los datos han sido eliminados. La pagina se recargara.');
        window.location.reload();
      } catch (err) {
        alert('Error al eliminar los datos: ' + err.message);
      }
    });
  }

  /** Cierra el modal de eliminacion. @private */
  function _closeDeleteModal() {
    const $modal = document.getElementById('cfg-delete-modal');
    const $input = document.getElementById('cfg-delete-confirm-input');
    const $btn = document.getElementById('cfg-delete-confirm-btn');
    if ($modal) $modal.style.display = 'none';
    if ($input) $input.value = '';
    if ($btn) $btn.disabled = true;
  }

  /* ═════════════════════════════  9e. APARIENCIA  ═════════════════════════════ */

  /** Renderiza la seccion de apariencia (tema y color de acento). */
  function renderAppearance() {
    const $wrap = document.getElementById('cfg-appearance');
    if (!$wrap) return;

    const currentTheme = document.documentElement.dataset.theme || 'dark';
    const themeLabel = currentTheme === 'light' ? 'Claro' : 'Oscuro';
    const themeIcon = currentTheme === 'light'
      ? '<svg class="ico" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg class="ico" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    const currentAccent = localStorage.getItem('bitacora_accent') || '#3fb950';

    let accentButtonsHtml = '';
    ACCENT_COLORS.forEach(c => {
      const isActive = c.hex === currentAccent ? 'is-active' : '';
      accentButtonsHtml += `<button class="accent-btn ${isActive}" data-color="${c.hex}" title="${c.name}" onclick="Config.setAccent('${c.hex}')"></button>`;
    });

    $wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <span style="font-size:0.875rem;color:#94a3b8;min-width:100px;">Tema</span>
        <button id="cfg-theme-toggle" class="theme-toggle" onclick="Config.toggleTheme()">
          ${themeIcon}
          <span>${themeLabel}</span>
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <span style="font-size:0.875rem;color:#94a3b8;min-width:100px;">Color primario</span>
        <div class="accent-picker">
          ${accentButtonsHtml}
        </div>
      </div>
    `;
  }

  /** Cambia entre tema oscuro y claro. */
  function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('bitacora_theme', next);
    renderAppearance();
  }

  /** Cambia el color de acento primario. */
  function setAccent(color) {
    document.documentElement.style.setProperty('--green', color);
    document.documentElement.style.setProperty('--green-dim', color);
    document.documentElement.style.setProperty('--accent-green', color);
    localStorage.setItem('bitacora_accent', color);
    renderAppearance();
  }

  /* ═════════════════════════════  API PUBLICA  ═════════════════════════════ */

  return {
    init,
    render,
    renderProviders,
    showAddProvider,
    renderActionButtons,
    exportData,
    importData,
    renderDangerZone,
    renderAppearance,
    toggleTheme,
    setAccent
  };

})();