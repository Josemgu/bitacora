/**
 * health.js — F7: Diagnóstico de errores para Bitácora
 * JavaScript vanilla (ES6+), sin frameworks.
 * Expone namespace global `Health`.
 *
 * Dependencias:
 *   - DB (namespace de js/db.js)
 *
 * Uso:
 *   Health.init()            → Inicializa captura de errores y panel
 *   Health.checkAll()        → Diagnóstico completo de la app
 *   Health.renderStatus()    → Actualiza grid de módulos
 *   Health.renderActivity()  → Lista de eventos recientes
 *   Health.explainError(id)  → Pide a la IA que explique un error
 *   Health.resolveError(id)  → Marca error como resuelto
 *   Health.clearOldErrors(d) → Limpia errores antiguos
 *   Health.startMonitoring() → Monitoreo periódico cada 30 s
 *   Health.stopMonitoring()  → Detiene monitoreo
 */

const Health = (() => {
  'use strict';

  /* ================================================================
     CONFIGURACIÓN Y ESTADO INTERNO
     ================================================================ */
  const STORE       = 'health_events';
  const MONITOR_MS  = 30_000;   // 30 segundos
  let monitorId     = null;     // ID del setInterval
  let initialized   = false;

  /* ================================================================
     UTILIDADES
     ================================================================ */

  /**
   * Genera un hash simple (FNV-1a) para agrupar errores idénticos.
   */
  function _hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Normaliza un mensaje de error quitando URLs, timestamps y valores variables.
   */
  function _normalizeMessage(msg) {
    if (!msg) return 'Error desconocido';
    return String(msg)
      .replace(/https?:\/\/[^\s]+/g, '<url>')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d.Z]*/g, '<ts>')
      .replace(/'[^']*'/g, "'<val>'")
      .replace(/`[^`]*`/g, '`<val>`')
      .trim();
  }

  /**
   * Normaliza un stack trace manteniendo solo las líneas de código del usuario.
   */
  function _normalizeStack(error) {
    if (!error || !error.stack) return '';
    return error.stack
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.includes('/node_modules/'))
      .join('\n');
  }

  /**
   * Calcula un hash de agrupación a partir de mensaje + stack.
   */
  function _groupHash(message, stack) {
    return _hash(_normalizeMessage(message) + '|' + (stack || ''));
  }

  /**
   * Timestamp relativo humano: "hace 2h", "hace 3d", etc.
   */
  function _timeAgo(ts) {
    const diff = Date.now() - ts;
    const s    = Math.floor(diff / 1000);
    if (s < 60)   return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
    if (s < 86400)return `hace ${Math.floor(s / 3600)}h`;
    const d = Math.floor(s / 86400);
    return d < 30 ? `hace ${d}d` : `hace ${Math.floor(d / 30)}m`;
  }

  /**
   * Wrapper seguro para invocar DB.getAll / DB.add / DB.update / DB.delete.
   */
  function _dbGetAll(store) {
    try { return DB.getAll(store); } catch (e) { return []; }
  }
  function _dbAdd(store, item) {
    try { return DB.add(store, item); } catch (e) { return null; }
  }
  function _dbUpdate(store, id, changes) {
    try { return DB.update(store, id, changes); } catch (e) { return false; }
  }
  function _dbDelete(store, id) {
    try { return DB.delete(store, id); } catch (e) { return false; }
  }

  /* ================================================================
     7a. ERRORES DE JS DEL CLIENTE
     ================================================================ */

  /**
   * Inicializa el sistema de diagnóstico.
   * Registra window.onerror y window.onunhandledrejection.
   */
  function init() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('error', (e) => {
      captureError(e.message, e.filename, e.lineno, e.colno, e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
      captureRejection(e);
    });

    // Auto-limpieza al iniciar
    clearOldErrors(30);
  }

  /**
   * Captura un error de JavaScript, normaliza, agrupa y guarda.
   */
  function captureError(message, source, lineno, colno, error) {
    const stack    = _normalizeStack(error);
    const normMsg  = _normalizeMessage(message);
    const gHash    = _groupHash(normMsg, stack);

    const events   = _dbGetAll(STORE);

    // Buscar si ya existe un evento con el mismo hash y sin resolver
    const existing = events.find(ev =>
      ev.kind === 'js_error' &&
      ev.groupHash === gHash &&
      !ev.resolved
    );

    if (existing) {
      // Incrementar contador y actualizar última ocurrencia
      existing.count      = (existing.count || 1) + 1;
      existing.lastSeen   = Date.now();
      existing.occurrences = [...(existing.occurrences || [existing.timestamp]), Date.now()];
      // Actualizar source/lineno si cambió
      existing.source     = source || existing.source;
      existing.lineno     = lineno || existing.lineno;
      existing.colno      = colno || existing.colno;
      _dbUpdate(STORE, existing.id, existing);
    } else {
      const healthEvent = {
        kind:          'js_error',
        message:       normMsg,
        rawMessage:    message || '',
        source:        source  || '',
        lineno:        lineno  || 0,
        colno:         colno   || 0,
        stack:         stack,
        groupHash:     gHash,
        count:         1,
        timestamp:     Date.now(),
        lastSeen:      Date.now(),
        occurrences:   [Date.now()],
        resolved:      false,
        resolvedAt:    null,
        view:          document.title || window.location.pathname,
        userAgent:     navigator.userAgent
      };
      _dbAdd(STORE, healthEvent);
    }

    // Actualizar panel sin recargar la página
    renderStatus();
    renderActivity();
  }

  /**
   * Captura un unhandled promise rejection.
   */
  function captureRejection(event) {
    let message = 'Unhandled Promise Rejection';
    let stack   = '';

    if (event.reason) {
      if (typeof event.reason === 'string') {
        message = event.reason;
      } else if (event.reason instanceof Error) {
        message = event.reason.message || message;
        stack   = _normalizeStack(event.reason);
      } else {
        try {
          message = JSON.stringify(event.reason);
        } catch {
          message = 'Promise rejected with non-serializable value';
        }
      }
    }

    const normMsg = _normalizeMessage(message);
    const gHash   = _groupHash(normMsg, stack);
    const events  = _dbGetAll(STORE);

    const existing = events.find(ev =>
      ev.kind === 'js_error' &&
      ev.groupHash === gHash &&
      !ev.resolved
    );

    if (existing) {
      existing.count       = (existing.count || 1) + 1;
      existing.lastSeen    = Date.now();
      existing.occurrences = [...(existing.occurrences || [existing.timestamp]), Date.now()];
      _dbUpdate(STORE, existing.id, existing);
    } else {
      const healthEvent = {
        kind:          'js_error',
        message:       normMsg,
        rawMessage:    message,
        source:        '',
        lineno:        0,
        colno:         0,
        stack:         stack,
        groupHash:     gHash,
        count:         1,
        timestamp:     Date.now(),
        lastSeen:      Date.now(),
        occurrences:   [Date.now()],
        resolved:      false,
        resolvedAt:    null,
        view:          document.title || window.location.pathname,
        userAgent:     navigator.userAgent
      };
      _dbAdd(STORE, healthEvent);
    }

    renderStatus();
    renderActivity();

    // No prevenir el comportamiento por defecto para que el error siga visible en consola
  }

  /**
   * Retorna errores agrupados con contador, ordenados por frecuencia (más comunes primero).
   */
  function getErrorGroups() {
    const events = _dbGetAll(STORE).filter(ev => ev.kind === 'js_error' && !ev.resolved);
    // Ordenar por count descendente, luego por lastSeen descendente
    return events.sort((a, b) => {
      const diffCount = (b.count || 1) - (a.count || 1);
      if (diffCount !== 0) return diffCount;
      return (b.lastSeen || b.timestamp) - (a.lastSeen || a.timestamp);
    });
  }

  /* ================================================================
     7b. SALUD DE LA APP
     ================================================================ */

  /**
   * Revisa cada módulo y retorna el estado general.
   * @returns {{db:string, ai:string, links:string, queue:string, jsErrors:string}}
   */
  function checkAll() {
    return {
      db:       _checkDB(),
      ai:       _checkAI(),
      links:    _checkLinks(),
      queue:    _checkQueue(),
      jsErrors: _checkJSErrors()
    };
  }

  /** Estado de localStorage (DB). */
  function _checkDB() {
    try {
      const key = '__health_test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return 'ok';
    } catch {
      return 'warn';
    }
  }

  /** Estado del proveedor IA. */
  function _checkAI() {
    try {
      const cfg = JSON.parse(localStorage.getItem('ai_config') || '{}');
      const hasProvider = !!(cfg.provider && cfg.apiKey);
      return hasProvider ? 'ok' : 'warn';
    } catch {
      return 'warn';
    }
  }

  /** Estado del verificador de links (cantidad de rotos). */
  function _checkLinks() {
    try {
      const broken = _dbGetAll('resources').filter(l => l.status === 'broken');
      return broken.length === 0 ? 'ok' : 'warn';
    } catch {
      return 'warn';
    }
  }

  /** Estado de la cola de aprobación. */
  function _checkQueue() {
    try {
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const stale = _dbGetAll('resource_queue').filter(q => {
        const age = Date.now() - (q.timestamp || 0);
        return age > sevenDays;
      });
      return stale.length === 0 ? 'ok' : 'warn';
    } catch {
      return 'ok';
    }
  }

  /** Estado de errores JS sin resolver. */
  function _checkJSErrors() {
    const unresolved = _dbGetAll(STORE).filter(ev => ev.kind === 'js_error' && !ev.resolved);
    return unresolved.length === 0 ? 'ok' : 'warn';
  }

  /**
   * Actualiza el panel de sistema (.mod-grid) con los estados actuales.
   */
  function renderStatus() {
    const status = checkAll();

    const modules = [
      { key: 'db',       label: 'Base de datos',       okText: 'Conexión activa',              warnText: 'Problemas de almacenamiento' },
      { key: 'ai',       label: 'Proveedor IA',        okText: 'Proveedor activo',             warnText: 'Sin proveedor configurado' },
      { key: 'links',    label: 'Verificador de links', okText: 'Sin links rotos',             warnText: 'Hay links rotos' },
      { key: 'queue',    label: 'Cola de aprobación',  okText: 'Sin pendientes antiguos',      warnText: 'Hay pendientes de >7 días' },
      { key: 'jsErrors', label: 'Diagnóstico',         okText: 'Sin errores recientes',        warnText: 'Hay errores sin resolver' }
    ];

    const grid = document.querySelector('.mod-grid');
    if (!grid) return;

    const modEls = grid.querySelectorAll('.mod');

    modules.forEach((mod, idx) => {
      const el    = modEls[idx];
      if (!el) return;

      const state = status[mod.key];
      const stateEl = el.querySelector('.mod-state');
      const descEl  = el.querySelector('span');

      if (stateEl) {
        stateEl.classList.remove('ok', 'warn');
        stateEl.classList.add(state);
      }
      if (descEl) {
        descEl.textContent = state === 'ok' ? mod.okText : mod.warnText;
      }
    });
  }

  /**
   * Muestra lista de eventos recientes en .activity.
   * Formato: mensaje + timestamp relativo. Punto rojo para no resueltos.
   */
  function renderActivity() {
    const list = document.querySelector('.activity');
    if (!list) return;

    const events = _dbGetAll(STORE)
      .filter(ev => ev.kind === 'js_error')
      .sort((a, b) => (b.lastSeen || b.timestamp) - (a.lastSeen || a.timestamp))
      .slice(0, 20); // Últimos 20

    if (events.length === 0) {
      list.innerHTML = '<li><span>No hay eventos recientes</span></li>';
      return;
    }

    list.innerHTML = events.map(ev => {
      const time     = _timeAgo(ev.lastSeen || ev.timestamp);
      const count    = ev.count > 1 ? ` <strong>(${ev.count}x)</strong>` : '';
      const dot      = !ev.resolved
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e74c3c;margin-right:6px;"></span>'
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2ecc71;margin-right:6px;"></span>';
      const msgShort = ev.message.length > 60 ? ev.message.slice(0, 60) + '…' : ev.message;

      return `<li>${dot}<span>${msgShort}${count}</span> <em>${time}</em></li>`;
    }).join('');
  }

  /* ================================================================
     7c. IA EXPLICA EL ERROR
     ================================================================ */

  /**
   * Pide al proveedor de IA activo que explique un error.
   * Muestra la explicación en un panel expandable.
   */
  async function explainError(errorId) {
    const events = _dbGetAll(STORE);
    const ev     = events.find(e => e.id === errorId || e.id == errorId);
    if (!ev) {
      console.warn('[Health] explainError: error no encontrado:', errorId);
      return;
    }

    const prompt =
      `Este error ocurrió en Bitácora (Next.js + Drizzle + Supabase).\n` +
      `Error: ${ev.message}\n` +
      `Stack: ${ev.stack || '(no disponible)'}\n` +
      `Vista: ${ev.view || 'desconocida'}\n` +
      `Explica en español: qué significa, la causa más probable y cómo arreglarlo.`;

    // Buscar contenedor del panel
    let panel = document.getElementById('health-explain-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'health-explain-panel';
      panel.className = 'health-explain-panel';
      panel.innerHTML = `
        <div class="explain-header">
          <strong>Explicación del error</strong>
          <button class="explain-close" aria-label="Cerrar">×</button>
        </div>
        <div class="explain-body"><p class="explain-loading">Consultando IA…</p></div>
      `;
      document.body.appendChild(panel);
      panel.querySelector('.explain-close').addEventListener('click', () => {
        panel.classList.remove('open');
      });
    }

    panel.classList.add('open');
    const body = panel.querySelector('.explain-body');
    body.innerHTML = '<p class="explain-loading">Consultando IA…</p>';

    // Invocar proveedor IA a través del namespace global AI si existe
    try {
      let explanation = null;

      if (typeof AI !== 'undefined' && AI.ask) {
        explanation = await AI.ask(prompt);
      } else if (typeof AI !== 'undefined' && AI.complete) {
        explanation = await AI.complete(prompt);
      } else {
        // Fallback: intentar fetch directo si hay configuración
        const cfg = JSON.parse(localStorage.getItem('ai_config') || '{}');
        if (cfg.provider && cfg.apiKey && cfg.apiUrl) {
          const resp = await fetch(cfg.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify({
              model: cfg.model || 'gpt-4',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.3
            })
          });
          const data = await resp.json();
          explanation = data.choices?.[0]?.message?.content
                     || data.message?.content
                     || data.text
                     || '(Sin respuesta de la IA)';
        } else {
          explanation = 'No hay proveedor de IA configurado. Configura uno en Ajustes → IA para obtener explicaciones de errores.';
        }
      }

      // Renderizar explicación con formato simple (saltos de línea → <p>)
      const paragraphs = explanation
        .split('\n')
        .filter(l => l.trim())
        .map(l => `<p>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('');

      body.innerHTML = paragraphs || `<p>${explanation}</p>`;
    } catch (err) {
      body.innerHTML = `<p class="explain-error">No se pudo consultar la IA: ${err.message}</p>`;
    }
  }

  /* ================================================================
     FUNCIONES ADICIONALES
     ================================================================ */

  /**
   * Marca un error como resuelto.
   */
  function resolveError(errorId) {
    const ok = _dbUpdate(STORE, errorId, { resolved: true, resolvedAt: Date.now() });
    if (ok) {
      renderStatus();
      renderActivity();
    }
    return ok;
  }

  /**
   * Elimina errores resueltos con más de N días.
   * Se ejecuta automáticamente al iniciar (init).
   */
  function clearOldErrors(days = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const events = _dbGetAll(STORE);
    let removed = 0;

    events.forEach(ev => {
      if (ev.resolved && ev.resolvedAt && ev.resolvedAt < cutoff) {
        _dbDelete(STORE, ev.id);
        removed++;
      }
    });

    if (removed > 0) {
      console.log(`[Health] ${removed} errores antiguos eliminados (> ${days} días)`);
    }
    return removed;
  }

  /**
   * Inicia monitoreo periódico cada 30 segundos.
   */
  function startMonitoring() {
    stopMonitoring();
    monitorId = setInterval(() => {
      renderStatus();
      renderActivity();
    }, MONITOR_MS);
    console.log('[Health] Monitoreo iniciado (30s)');
  }

  /**
   * Detiene el monitoreo periódico.
   */
  function stopMonitoring() {
    if (monitorId) {
      clearInterval(monitorId);
      monitorId = null;
      console.log('[Health] Monitoreo detenido');
    }
  }

  /* ================================================================
     API PÚBLICA
     ================================================================ */
  return {
    init,
    captureError,
    captureRejection,
    getErrorGroups,
    checkAll,
    renderStatus,
    renderActivity,
    explainError,
    resolveError,
    clearOldErrors,
    startMonitoring,
    stopMonitoring
  };
})();

/* ====================================================================
   AUTO-INICIALIZACIÓN
   ==================================================================== */

// Escuchar errores globales
document.addEventListener('DOMContentLoaded', () => {
  Health.init();
  Health.startMonitoring();
});

// También capturar errores que ocurran antes de DOMContentLoaded
window.addEventListener('error', (e) => {
  if (typeof Health !== 'undefined' && Health.captureError) {
    Health.captureError(e.message, e.filename, e.lineno, e.colno, e.error);
  }
});
window.addEventListener('unhandledrejection', (e) => {
  if (typeof Health !== 'undefined' && Health.captureRejection) {
    Health.captureRejection(e);
  }
});