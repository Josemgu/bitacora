/**
 * ai-chat.js — F3: Proveedor de IA con multi-backend, streaming SSE y chat UI.
 * Namespace global: AIChat
 * Dependencias: DB (js/db.js)
 *
 * Soporta: OpenAI, Anthropic, Google Gemini, Ollama (local).
 * La clave API se mantiene SOLO en memoria (variable JS), nunca en localStorage.
 */
const AIChat = (() => {
  'use strict';

  /* ═════════════════════════════  ESTADO  ═════════════════════════════ */

  const state = {
    providers: [],          // Lista de proveedores cargados desde DB
    activeProvider: null,   // Proveedor seleccionado o 'local' | null
    messages: [],           // Historial de mensajes de la sesion
    apiKeys: new Map(),     // Claves API en memoria: providerId -> key
    isStreaming: false,     // Flag para evitar envios simultaneos
    abortCtrl: null         // AbortController para cancelar requests
  };

  /* Referencias DOM (cache) */
  let $container = null;
  let $providerSelect = null;
  let $chatLog = null;
  let $chatInput = null;
  let $sendBtn = null;
  let $keyInput = null;
  let $keyNote = null;

  /* ═════════════════════════════  CONSTANTES  ═════════════════════════════ */

  const STORAGE_KEY = 'bitacora_ai_chat_history';
  const TIMEOUT_MS = 30000;

  /* Plantillas de endpoint por proveedor */
  const ENDPOINT_TEMPLATES = {
    openai:   'https://api.openai.com/v1/chat/completions',
    anthropic:'https://api.anthropic.com/v1/messages',
    google:   'https://generativelanguage.googleapis.com/v1beta/models',
    ollama:   'http://localhost:11434/api/chat'
  };

  /* ═════════════════════════════  UTILIDADES  ═════════════════════════════ */

  const esc = (str) => {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  };

  const nowISO = () => new Date().toISOString();

  /** Muestra una clave API enmascarada: sk-xxxxxxxxxxxx...4f2a */
  const maskKey = (key) => {
    if (!key || key.length < 8) return '...';
    const vis = 4; // caracteres visibles al inicio (despues del prefijo)
    const end = 4; // caracteres visibles al final
    const prefix = key.slice(0, vis);
    const suffix = key.slice(-end);
    return prefix + '...' + suffix;
  };

  /** Extrae el nombre de la env var sin el prefijo $ */
  const envName = (raw) => raw ? raw.replace(/^\$/, '') : '';

  /* ═════════════════════════════  PROVEEDORES  ═════════════════════════════ */

  /**
   * Proveedor OpenAI.
   * Usa la API de chat completions con streaming SSE.
   */
  const openaiProvider = {
    name: 'OpenAI',

    async chat(messages, opts = {}) {
      const { apiKey, model = 'gpt-4o-mini', endpoint = ENDPOINT_TEMPLATES.openai } = opts;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, stream: false })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    },

    async *chatStream(messages, opts = {}) {
      const { apiKey, model = 'gpt-4o-mini', endpoint = ENDPOINT_TEMPLATES.openai, signal } = opts;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, messages, stream: true })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const t = line.trim();
            if (!t || !t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
              const json = JSON.parse(payload);
              const chunk = json.choices?.[0]?.delta?.content;
              if (chunk) yield chunk;
            } catch { /* ignora JSON malformado */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  };

  /**
   * Proveedor Anthropic.
   * El system prompt va como parametro separado (no en messages).
   */
  const anthropicProvider = {
    name: 'Anthropic',

    async chat(messages, opts = {}) {
      const { apiKey, model = 'claude-3-haiku-20240307', endpoint = ENDPOINT_TEMPLATES.anthropic } = opts;
      const { system, userMessages } = _splitSystem(messages);
      const body = { model, max_tokens: 4096, messages: userMessages };
      if (system) body.system = system;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const data = await res.json();
      return data.content?.[0]?.text || '';
    },

    async *chatStream(messages, opts = {}) {
      const { apiKey, model = 'claude-3-haiku-20240307', endpoint = ENDPOINT_TEMPLATES.anthropic, signal } = opts;
      const { system, userMessages } = _splitSystem(messages);
      const body = { model, max_tokens: 4096, messages: userMessages, stream: true };
      if (system) body.system = system;

      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('event:') && !t.startsWith('data:')) continue;
            if (t.startsWith('event:')) continue;
            const payload = t.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
              const json = JSON.parse(payload);
              if (json.type === 'content_block_delta') {
                const chunk = json.delta?.text;
                if (chunk) yield chunk;
              }
            } catch { /* ignora */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  };

  /**
   * Proveedor Google Gemini.
   * Usa generativelanguage.googleapis.com.
   */
  const googleProvider = {
    name: 'Google',

    async chat(messages, opts = {}) {
      const { apiKey, model = 'gemini-1.5-flash', endpoint } = opts;
      const modelName = model.includes('/') ? model : `models/${model}`;
      const url = endpoint || `${ENDPOINT_TEMPLATES.google}/${modelName}:generateContent?key=${apiKey}`;
      const contents = _toGoogleContents(messages);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },

    async *chatStream(messages, opts = {}) {
      const { apiKey, model = 'gemini-1.5-flash', endpoint, signal } = opts;
      const modelName = model.includes('/') ? model : `models/${model}`;
      const url = endpoint || `${ENDPOINT_TEMPLATES.google}/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const contents = _toGoogleContents(messages);

      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            try {
              const json = JSON.parse(payload);
              const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunk) yield chunk;
            } catch { /* ignora */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  };

  /**
   * Proveedor Ollama (local).
   * No requiere clave API. Corre en localhost:11434.
   */
  const ollamaProvider = {
    name: 'Ollama',

    async chat(messages, opts = {}) {
      const { model = 'llama3.2', endpoint = ENDPOINT_TEMPLATES.ollama } = opts;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      const data = await res.json();
      return data.message?.content || '';
    },

    async *chatStream(messages, opts = {}) {
      const { model = 'llama3.2', endpoint = ENDPOINT_TEMPLATES.ollama, signal } = opts;
      const res = await fetch(endpoint, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true })
      });
      if (!res.ok) throw new HttpError(res.status, await res.text());
      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          // Ollama envia JSON por linea: {"message":{"content":"..."}}
          const lines = chunk.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const json = JSON.parse(t);
              const text = json.message?.content;
              if (text) yield text;
              if (json.done) return;
            } catch { /* ignora lineas malformadas */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  };

  /* ═════════════════════════════  HELPERS INTERNOS  ═════════════════════════════ */

  /** Separa el system prompt de los mensajes (para Anthropic). */
  function _splitSystem(messages) {
    let system = '';
    const userMessages = [];
    for (const m of messages) {
      if (m.role === 'system') {
        system += (system ? '\n' : '') + m.content;
      } else {
        userMessages.push(m);
      }
    }
    return { system, userMessages };
  }

  /** Convierte mensajes al formato de Google Gemini. */
  function _toGoogleContents(messages) {
    // Fusionar system en el primer mensaje de usuario
    let systemText = '';
    const contents = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemText += m.content + '\n';
        continue;
      }
      const role = m.role === 'user' ? 'user' : 'model';
      contents.push({
        role,
        parts: [{ text: (role === 'user' && systemText ? systemText : '') + m.content }]
      });
      if (role === 'user') systemText = ''; // Solo inyectar system una vez
    }
    return contents;
  }

  /** Error HTTP con codigo de estado. */
  class HttpError extends Error {
    constructor(status, body = '') {
      super(`HTTP ${status}`);
      this.status = status;
      this.body = body;
    }
  }

  /** Obtiene el proveedor de implementacion segun el tipo. */
  function _getImpl(providerRecord) {
    if (!providerRecord) return null;
    const name = (providerRecord.name || '').toLowerCase();
    if (name.includes('openai')) return openaiProvider;
    if (name.includes('anthropic') || name.includes('claude')) return anthropicProvider;
    if (name.includes('google') || name.includes('gemini')) return googleProvider;
    if (name.includes('ollama')) return ollamaProvider;
    // Fallback: detectar por endpoint
    const ep = (providerRecord.endpoint || '').toLowerCase();
    if (ep.includes('openai.com')) return openaiProvider;
    if (ep.includes('anthropic')) return anthropicProvider;
    if (ep.includes('googleapis')) return googleProvider;
    if (ep.includes('localhost:11434') || ep.includes('ollama')) return ollamaProvider;
    // Default a OpenAI si no se puede detectar
    return openaiProvider;
  }

  /** Resuelve la clave API para un proveedor (memoria > input DOM). */
  function _getApiKey(providerId) {
    // 1. Memoria en caliente
    if (state.apiKeys.has(providerId)) {
      return state.apiKeys.get(providerId);
    }
    // 2. Input del DOM (si esta visible)
    if ($keyInput && $keyInput.value.trim()) {
      const key = $keyInput.value.trim();
      state.apiKeys.set(providerId, key);
      return key;
    }
    return null;
  }

  /** Devuelve un mensaje de error amigable segun el tipo de fallo. */
  function _friendlyError(err) {
    if (err instanceof HttpError) {
      if (err.status === 401) return 'La clave fue rechazada. Revisa que sea del proveedor correcto.';
      if (err.status === 429) return 'Limite de peticiones alcanzado. Espera unos segundos.';
      return `Error del servidor (${err.status}). Intenta de nuevo.`;
    }
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return 'El proveedor no respondio en 30 s.';
    }
    if (err.message && err.message.includes('fetch')) {
      return 'Este proveedor bloquea llamadas desde el navegador. Usa el backend u Ollama en local.';
    }
    if (err.message && err.message.includes('CORS')) {
      return 'Este proveedor bloquea llamadas desde el navegador. Usa el backend u Ollama en local.';
    }
    return 'Error de conexion. Revisa tu red y la configuracion del proveedor.';
  }

  /** Wrapper de fetch con timeout y AbortController. */
  async function _fetchWithTimeout(url, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        const te = new Error('timeout');
        te.name = 'TimeoutError';
        throw te;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ═════════════════════════════  SYSTEM PROMPT  ═════════════════════════════ */

  /** Construye el system prompt con contexto de Miguel. */
  function buildSystemPrompt() {
    const phases = DB.getAll('phases');
    const topics = DB.getAll('topics');

    // Fase actual
    const currentPhase = phases.find(p => p.status === 'in_progress') || phases[0];
    const phaseName = currentPhase ? currentPhase.name : 'Desconocida';
    const phaseNum = currentPhase ? currentPhase.order : 0;

    // Tema en curso
    const currentTopic = topics.find(t => t.status === 'in_progress');
    const topicName = currentTopic ? currentTopic.name : 'Ninguno';

    // Fases completadas
    const completedPhases = phases
      .filter(p => p.status === 'completed')
      .map(p => p.name)
      .join(', ');

    return [
      'Eres el asistente tecnico de la Bitacora de Miguel.',
      '',
      'Contexto actual:',
      `- Fase actual: ${phaseNum}. ${phaseName}`,
      `- Tema en curso: ${topicName}`,
      completedPhases ? `- Fases completadas: ${completedPhases}` : '- Aun no hay fases completadas.',
      '',
      'Instrucciones:',
      '- Responde SIEMPRE en espanol.',
      '- Da pasos concretos y accionables.',
      '- Relaciona las respuestas con proyectos de homelab cuando sea relevante.',
      '- Usa markdown para formato (listas, codigo, tablas).',
      '- Mantén las respuestas concisas pero completas.'
    ].join('\n');
  }

  /* ═════════════════════════════  RENDERIZADO  ═════════════════════════════ */

  /** Añade un mensaje al chat log. */
  function renderMessage(role, content) {
    if (!$chatLog) return;

    const $msg = document.createElement('div');
    $msg.className = `chat-msg chat-msg--${role}`;
    $msg.dataset.role = role;

    // Estilos inline segun rol
    const styles = {
      user:      'margin-left:auto; max-width:80%; background:#22c55e; color:#fff; padding:0.75rem 1rem; border-radius:1rem 1rem 0.25rem 1rem; margin-bottom:0.5rem; word-break:break-word;',
      assistant: 'margin-right:auto; max-width:80%; background:#1e293b; color:#e2e8f0; padding:0.75rem 1rem; border-radius:1rem 1rem 1rem 0.25rem; margin-bottom:0.5rem; word-break:break-word;',
      system:    'margin:0 auto; max-width:90%; background:#334155; color:#94a3b8; padding:0.5rem 1rem; border-radius:0.5rem; margin-bottom:0.5rem; font-size:0.875rem; text-align:center; font-style:italic;'
    };
    $msg.style.cssText = styles[role] || styles.system;

    // Contenido: convertir markdown simple
    $msg.innerHTML = _renderMarkdown(esc(content));

    $chatLog.appendChild($msg);
    _scrollToBottom();
  }

  /** Renderiza markdown simple a HTML. */
  function _renderMarkdown(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#0f172a;padding:0.75rem;border-radius:0.5rem;overflow-x:auto;margin:0.5rem 0;"><code style="font-family:monospace;font-size:0.875rem;">$2</code></pre>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code style="background:#0f172a;padding:0.125rem 0.375rem;border-radius:0.25rem;font-family:monospace;font-size:0.875rem;">$1</code>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline;">$1</a>');
    // Listas
    text = text.replace(/^- (.+)$/gm, '<li style="margin-left:1rem;">$1</li>');
    // Saltos de linea
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  /** Muestra el indicador "escribiendo...". */
  function _showTyping() {
    if (!_chatLog) return;
    const $el = document.createElement('div');
    $el.id = 'chat-typing';
    $el.className = 'chat-msg chat-msg--typing';
    $el.style.cssText = 'margin-right:auto; max-width:80%; background:#1e293b; color:#64748b; padding:0.75rem 1rem; border-radius:1rem 1rem 1rem 0.25rem; margin-bottom:0.5rem; font-style:italic;';
    $el.innerHTML = '<span class="typing-dots">Escribiendo<span>.</span><span>.</span><span>.</span></span>';
    $chatLog.appendChild($el);
    _scrollToBottom();
  }

  /** Oculta el indicador "escribiendo...". */
  function _hideTyping() {
    const $el = document.getElementById('chat-typing');
    if ($el) $el.remove();
  }

  /** Scroll al final del chat. */
  function _scrollToBottom() {
    if ($chatLog) $chatLog.scrollTop = $chatLog.scrollHeight;
  }

  /** Actualiza la nota de seguridad sobre la clave. */
  function _updateKeyNote() {
    if (!$keyNote) return;
    const providerId = state.activeProvider;
    if (!providerId || providerId === 'local') {
      $keyNote.textContent = 'Modo local: introduce una clave API para usar este proveedor.';
      return;
    }
    const key = state.apiKeys.get(providerId);
    if (key) {
      $keyNote.innerHTML = 'La clave se guarda cifrada en el servidor.';
    } else {
      $keyNote.textContent = 'Escribe la clave y envia un mensaje para guardarla cifrada en el servidor.';
    }
  }

  /* ═════════════════════════════  INICIALIZACION / UI  ═════════════════════════════ */

  /** Inicializa la vista de chat. */
  function init() {
    $container = document.getElementById('ai-chat-view');
    if (!$container) {
      console.warn('[AIChat] No se encontro #ai-chat-view');
      return;
    }

    // Cargar proveedores y renderizar
    loadProviders();
    _renderChatLayout();
    _cacheDOM();
    _bindEvents();
    renderProviderSelector();
    loadHistory();
  }

  /** Carga proveedores desde el backend (las claves viven cifradas en el servidor). */
  async function loadProviders() {
    try {
      state.providers = await API.getAIProviders();
      const active = state.providers.find(p => p.is_active);
      if (active) state.activeProvider = String(active.id);
    } catch (err) {
      console.error('[AIChat] Error cargando proveedores:', err);
      state.providers = [];
    }
    renderProviderSelector();
  }

  /** Renderiza el layout principal del chat. */
  function _renderChatLayout() {
    if (!$container) return;
    $container.innerHTML = `
      <div class="chat" style="display:flex;height:100%;gap:1rem;">
        <!-- Panel lateral: configuracion -->
        <aside class="chat-side panel" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:1rem;">
          <div class="panel-body" style="display:flex;flex-direction:column;gap:1rem;height:100%;">
            <h3 style="margin:0;font-size:1rem;color:#e2e8f0;">Proveedor de IA</h3>
            <div class="field">
              <label class="label" style="font-size:0.875rem;color:#94a3b8;">Proveedor</label>
              <select id="chat-provider" class="select" style="width:100%;"></select>
            </div>
            <div class="field" id="chat-key-field">
              <label class="label" style="font-size:0.875rem;color:#94a3b8;">Clave API</label>
              <input id="chat-api-key" class="input" type="password" placeholder="sk-..." autocomplete="off" style="width:100%;">
              <p id="chat-key-note" class="note" style="font-size:0.75rem;color:#64748b;margin-top:0.25rem;">La clave se guarda cifrada en el servidor; nunca se muestra ni viaja al navegador.</p>
            </div>
            <div style="margin-top:auto;display:flex;flex-direction:column;gap:0.5rem;">
              <button id="chat-clear" class="btn btn-ghost" style="width:100%;">Limpiar chat</button>
              <button id="chat-test" class="btn btn-ghost" style="width:100%;">Probar conexion</button>
            </div>
          </div>
        </aside>

        <!-- Area principal -->
        <main class="chat-main panel" style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
          <div class="chat-log panel-body" id="chat-log" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;">
            <div class="chat-msg chat-msg--system" style="margin:0 auto;max-width:90%;background:#334155;color:#94a3b8;padding:0.5rem 1rem;border-radius:0.5rem;margin-bottom:0.5rem;font-size:0.875rem;text-align:center;font-style:italic;">
              Bienvenido al asistente de Bitacora. Selecciona un proveedor y empieza a chatear.
            </div>
          </div>
          <div class="chat-input" style="padding:0.75rem 1rem;border-top:1px solid #334155;display:flex;gap:0.5rem;align-items:flex-end;">
            <textarea id="chat-textarea" class="input" placeholder="Escribe tu mensaje..." rows="1" style="flex:1;resize:none;max-height:120px;"></textarea>
            <button id="chat-send" class="btn btn-primary">Enviar</button>
          </div>
          <div class="chat-quick" style="padding:0 1rem 0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm chat-quick-btn" data-prompt="Resume mi progreso actual">Progreso</button>
            <button class="btn btn-ghost btn-sm chat-quick-btn" data-prompt="Que deberia estudiar hoy?">Que estudiar</button>
            <button class="btn btn-ghost btn-sm chat-quick-btn" data-prompt="Sugerencias de proyecto para mi homelab">Proyecto homelab</button>
            <button class="btn btn-ghost btn-sm chat-quick-btn" data-prompt="Explicame el tema actual como si tuviera 5 anos">Explicame como 5</button>
          </div>
        </main>
      </div>
    `;
  }

  /** Cache de referencias DOM. */
  function _cacheDOM() {
    $providerSelect = document.getElementById('chat-provider');
    $chatLog = document.getElementById('chat-log');
    $chatInput = document.getElementById('chat-textarea');
    $sendBtn = document.getElementById('chat-send');
    $keyInput = document.getElementById('chat-api-key');
    $keyNote = document.getElementById('chat-key-note');
  }

  /** Vincula eventos. */
  function _bindEvents() {
    if ($sendBtn) {
      $sendBtn.addEventListener('click', () => {
        const text = $chatInput.value.trim();
        if (text) sendMessage(text);
      });
    }

    if ($chatInput) {
      $chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = $chatInput.value.trim();
          if (text) sendMessage(text);
        }
      });
      // Auto-resize
      $chatInput.addEventListener('input', () => {
        $chatInput.style.height = 'auto';
        $chatInput.style.height = Math.min($chatInput.scrollHeight, 120) + 'px';
      });
    }

    if ($providerSelect) {
      $providerSelect.addEventListener('change', async () => {
        state.activeProvider = $providerSelect.value || null;
        _updateKeyField();
        _updateKeyNote();
        // Activar el proveedor en el servidor
        if (state.activeProvider) {
          try {
            await API.setActiveAIProvider(parseInt(state.activeProvider));
          } catch (err) {
            renderMessage('system', 'No se pudo activar el proveedor: ' + (err.message || ''));
          }
        }
      });
    }

    // Boton limpiar
    const $clearBtn = document.getElementById('chat-clear');
    if ($clearBtn) {
      $clearBtn.addEventListener('click', clearChat);
    }

    // Boton probar conexion (via backend)
    const $testBtn = document.getElementById('chat-test');
    if ($testBtn) {
      $testBtn.addEventListener('click', async () => {
        if (!state.activeProvider) {
          renderMessage('system', 'Selecciona un proveedor primero.');
          return;
        }
        renderMessage('system', 'Probando conexion...');
        const t0 = Date.now();
        try {
          await API.sendChatMessage('Responde únicamente: ok');
          renderMessage('system', `Conexion exitosa en ${Date.now() - t0}ms.`);
        } catch (err) {
          renderMessage('system', `Error: ${err.message || 'sin conexión'}`);
        }
      });
    }

    // Botones rapidos
    $container.querySelectorAll('.chat-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.dataset.prompt;
        if (prompt) sendMessage(prompt);
      });
    });
  }

  /** Actualiza la visibilidad del campo de clave segun el proveedor. */
  function _updateKeyField() {
    const $field = document.getElementById('chat-key-field');
    if (!$field) return;
    const provId = state.activeProvider;
    if (!provId || provId === 'local') {
      $field.style.display = 'block';
      return;
    }
    const prov = state.providers.find(p => String(p.id) === String(provId));
    const isOllama = prov && (prov.name || '').toLowerCase().includes('ollama');
    $field.style.display = isOllama ? 'none' : 'block';
  }

  /* ═════════════════════════════  SELECTOR DE PROVEEDORES  ═════════════════════════════ */

  /** Renderiza el select de proveedores (desde el backend). */
  function renderProviderSelector() {
    if (!$providerSelect) return;

    let html = '<option value="">-- Selecciona proveedor --</option>';
    state.providers.forEach(p => {
      const label = `${p.name} (${p.default_model || 'default'})${p.has_api_key ? ' 🔑' : ''}`;
      html += `<option value="${esc(p.id)}">${esc(label)}</option>`;
    });
    $providerSelect.innerHTML = html;

    if (state.activeProvider) {
      const opt = $providerSelect.querySelector(`option[value="${state.activeProvider}"]`);
      if (opt) $providerSelect.value = state.activeProvider;
    }

    _updateKeyField();
    _updateKeyNote();
  }

  /* ═════════════════════════════  ENVIO DE MENSAJES  ═════════════════════════════ */

  /**
   * Envía un mensaje a través del BACKEND (el profesor IA).
   * La clave API nunca sale del servidor — allí vive cifrada.
   */
  async function sendMessage(text) {
    if (state.isStreaming) return;

    // Si el usuario escribió una clave, guardarla cifrada en el servidor
    if ($keyInput && $keyInput.value.trim() && state.activeProvider) {
      try {
        await API.request(`/providers/${state.activeProvider}`, {
          method: 'PATCH',
          body: { api_key: $keyInput.value.trim() }
        });
        $keyInput.value = '';
        renderMessage('system', 'Clave guardada cifrada en el servidor.');
        await loadProviders();
      } catch (err) {
        renderMessage('system', 'No se pudo guardar la clave: ' + (err.message || 'error'));
      }
    }

    // Añadir mensaje del usuario
    state.messages.push({ role: 'user', content: text });
    renderMessage('user', text);

    if ($chatInput) {
      $chatInput.value = '';
      $chatInput.style.height = 'auto';
    }

    state.isStreaming = true;
    _showTyping();

    try {
      const res = await API.sendChatMessage(text);
      _hideTyping();
      const reply = res.reply || '(sin respuesta)';
      state.messages.push({ role: 'assistant', content: reply });
      const $msgEl = _createAssistantElement();
      if ($msgEl) $msgEl.innerHTML = _renderMarkdown(esc(reply));
      _scrollToBottom();
      saveHistory();
    } catch (err) {
      console.error('[AIChat] Error en sendMessage:', err);
      _hideTyping();
      renderMessage('system', err.message || _friendlyError(err));
    } finally {
      state.isStreaming = false;
      _hideTyping();
    }
  }

  /** Envio directo a la API del proveedor (modo local con clave en memoria). */
  async function _sendDirect(messages, provRecord) {
    const impl = _getImpl(provRecord);
    const apiKey = state.apiKeys.get(state.activeProvider);
    const opts = {
      apiKey,
      model: provRecord.model,
      endpoint: provRecord.endpoint || undefined
    };

    _hideTyping();
    const $msgEl = _createAssistantElement();

    let fullText = '';
    try {
      for await (const chunk of impl.chatStream(messages, opts)) {
        fullText += chunk;
        if ($msgEl) $msgEl.innerHTML = _renderMarkdown(esc(fullText));
        _scrollToBottom();
      }
    } catch (err) {
      if ($msgEl) $msgEl.remove();
      throw err;
    }

    state.messages.push({ role: 'assistant', content: fullText });
  }

  /** Envio a Ollama local. */
  async function _sendOllama(messages, provRecord) {
    const opts = {
      model: provRecord?.model || 'llama3.2',
      endpoint: provRecord?.endpoint || ENDPOINT_TEMPLATES.ollama
    };

    _hideTyping();
    const $msgEl = _createAssistantElement();

    let fullText = '';
    try {
      // Ollama no usa clave, hacemos fetch directo
     const res = await _fetchWithTimeout(opts.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opts.model, messages, stream: true })
      });

      if (!res.ok) throw new HttpError(res.status, await res.text());
      if (!res.body) throw new Error('No body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const json = JSON.parse(t);
              const text = json.message?.content;
              if (text) {
                fullText += text;
                if ($msgEl) $msgEl.innerHTML = _renderMarkdown(esc(fullText));
                _scrollToBottom();
              }
              if (json.done) break;
            } catch { /* ignora */ }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if ($msgEl) $msgEl.remove();
      throw err;
    }

    state.messages.push({ role: 'assistant', content: fullText });
  }

  /** Envio via backend (simulado con fetch a /api/ai/chat). */
  async function _sendLocal(messages, provRecord) {
    // Si hay proveedor seleccionado y clave, llama directo
    if (provRecord) {
      return _sendDirect(messages, provRecord);
    }

    // Sin proveedor ni backend: mostrar error
    renderMessage('system', 'En modo local necesitas un proveedor con clave API configurada.');
  }

  /** Crea un elemento de mensaje del asistente vacio para ir llenandolo. */
  function _createAssistantElement() {
    if (!$chatLog) return null;
    const $msg = document.createElement('div');
    $msg.className = 'chat-msg chat-msg--assistant';
    $msg.dataset.role = 'assistant';
    $msg.style.cssText = 'margin-right:auto; max-width:80%; background:#1e293b; color:#e2e8f0; padding:0.75rem 1rem; border-radius:1rem 1rem 1rem 0.25rem; margin-bottom:0.5rem; word-break:break-word;';
    $msg.innerHTML = '<span style="color:#64748b;font-style:italic;">...</span>';
    $chatLog.appendChild($msg);
    _scrollToBottom();
    return $msg;
  }

  /* ═════════════════════════════  TEST DE CONEXION  ═════════════════════════════ */

  /**
   * Prueba la conexion con un proveedor.
   * @param {number|string} providerId — ID del proveedor
   * @returns {Promise<{ok:boolean, latencyMs:number, error?:string}>}
   */
  async function testConnection(providerId) {
    const prov = state.providers.find(p => String(p.id) === String(providerId));
    if (!prov) return { ok: false, latencyMs: 0, error: 'Proveedor no encontrado' };

    const impl = _getImpl(prov);
    const isOllama = (prov.name || '').toLowerCase().includes('ollama');
    const apiKey = isOllama ? null : (state.apiKeys.get(providerId) || '');

    // Si no hay clave y no es Ollama, no se puede probar
    if (!isOllama && !apiKey) {
      return { ok: false, latencyMs: 0, error: 'No hay clave API configurada para este proveedor' };
    }

    const testMessages = [{ role: 'user', content: 'Hola' }];
    const start = performance.now();

    try {
      const opts = {
        apiKey,
        model: prov.model,
        endpoint: prov.endpoint || undefined
      };
      await impl.chat(testMessages, opts);
      const latencyMs = Math.round(performance.now() - start);
      return { ok: true, latencyMs };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return { ok: false, latencyMs, error: _friendlyError(err) };
    }
  }

  /* ═════════════════════════════  HISTORIAL  ═════════════════════════════ */

  /** Limpia el historial de mensajes. */
  function clearChat() {
    state.messages = [];
    if ($chatLog) {
      $chatLog.innerHTML = `
        <div class="chat-msg chat-msg--system" style="margin:0 auto;max-width:90%;background:#334155;color:#94a3b8;padding:0.5rem 1rem;border-radius:0.5rem;margin-bottom:0.5rem;font-size:0.875rem;text-align:center;font-style:italic;">
          Chat limpiado. Empieza una nueva conversacion.
        </div>
      `;
    }
    saveHistory();
  }

  /** Guarda el historial en localStorage. */
  function saveHistory() {
    try {
      const data = {
        messages: state.messages,
        savedAt: nowISO(),
        provider: state.activeProvider
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('[AIChat] Error guardando historial:', err);
    }
  }

  /** Carga el historial desde localStorage. */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.messages && Array.isArray(data.messages)) {
        state.messages = data.messages;
        // Renderizar mensajes cargados
        if ($chatLog) {
          $chatLog.innerHTML = '';
          state.messages.forEach(m => renderMessage(m.role, m.content));
        }
      }
      if (data.provider) {
        state.activeProvider = data.provider;
        if ($providerSelect) {
          const opt = $providerSelect.querySelector(`option[value="${data.provider}"]`);
          if (opt) $providerSelect.value = data.provider;
        }
      }
    } catch (err) {
      console.error('[AIChat] Error cargando historial:', err);
    }
  }

  /* ═════════════════════════════  API PUBLICA  ═════════════════════════════ */

  return {
    // Estado expuesto (solo lectura externa recomendada)
    get activeProvider() { return state.activeProvider; },
    set activeProvider(v) { state.activeProvider = v; },
    get messages() { return [...state.messages]; },
    get isStreaming() { return state.isStreaming; },

    // Funciones principales
    init,
    loadProviders,
    renderProviderSelector,
    sendMessage,
    renderMessage,
    buildSystemPrompt,
    testConnection,
    clearChat,
    saveHistory,
    loadHistory,

    // Implementaciones de proveedores (acceso directo si es necesario)
    providers: {
      openai: openaiProvider,
      anthropic: anthropicProvider,
      google: googleProvider,
      ollama: ollamaProvider
    }
  };

})();