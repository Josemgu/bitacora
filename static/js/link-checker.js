/**
 * ============================================================================
 * link-checker.js — F4: Verificador de enlaces
 * ============================================================================
 * Comprueba el estado HTTP de los recursos almacenados, detecta links rotos,
 * redirecciones y actualiza la base de datos con los resultados.
 *
 * Caracteristicas:
 *   - SSRF protection (bloquea rangos privados, solo http/https)
 *   - Manejo de CORS desde navegador (mode: no-cors + proxy opcional)
 *   - Concurrencia maxima 5, rate-limit por host (200 ms)
 *   - Cancelable via AbortController
 *   - Clasificacion: ok | redirect | broken | unknown
 *
 * Namespace global: LinkChecker
 * Dependencias: DB (js/db.js)
 * ============================================================================
 */

const LinkChecker = (() => {
  'use strict';

  /* ──────────────────────── constantes ──────────────────────── */

  const TIMEOUT_MS = 10000;
  const MAX_CONCURRENT = 5;
  const HOST_DELAY_MS = 200;
  const USER_AGENT = 'Bitacora-LinkChecker/1.0';
  const MAX_REDIRECTS = 3;

  /** Rangos IP privados bloqueados (SSRF protection) */
  const PRIVATE_IPV4 = [
    { mask: 8,  start: 127 << 24 },           // 127.0.0.0/8
    { mask: 8,  start: 10  << 24 },           // 10.0.0.0/8
    { mask: 12, start: (172 << 24) | (16 << 16) },  // 172.16.0.0/12
    { mask: 16, start: (192 << 24) | (168 << 16) }, // 192.168.0.0/16
    { mask: 16, start: (169 << 24) | (254 << 16) }  // 169.254.0.0/16
  ];

  const STATUS_MAP = {
    ok:       { color: 'green',  dot: 'dot-green',  label: 'OK' },
    redirect: { color: 'yellow', dot: 'dot-yellow', label: 'Redirect' },
    broken:   { color: 'red',    dot: 'dot-red',    label: 'Roto' },
    unknown:  { color: 'gray',   dot: 'dot-gray',   label: 'Sin verificar' }
  };

  /* ──────────────────────── estado interno ──────────────────────── */

  let _abortController = null;
  let _isRunning = false;
  let _hostLastRequest = {}; // hostname -> timestamp

  /* ═══════════════════════════════════════════════════════════════════════
     INICIALIZACION
     ═══════════════════════════════════════════════════════════════════════ */

  function init() {
    console.log('[LinkChecker] Inicializado');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VERIFICACION INDIVIDUAL
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Verifica el estado HTTP de un recurso por su ID.
   * @param {number} resourceId
   * @returns {Promise<{status: string, httpCode: number|null}>}
   */
  async function verifyOne(resourceId) {
    const resource = DB.getById('resources', resourceId);
    if (!resource) {
      console.warn('[LinkChecker] Recurso no encontrado:', resourceId);
      return { status: 'unknown', httpCode: null };
    }

    if (!resource.url) {
      console.warn('[LinkChecker] Recurso sin URL:', resourceId);
      return { status: 'unknown', httpCode: null };
    }

    /* SSRF check */
    if (!canCheckUrl(resource.url)) {
      console.warn('[LinkChecker] URL bloqueada por SSRF protection:', resource.url);
      return { status: 'unknown', httpCode: null };
    }

    const result = await _checkUrl(resource.url);

    /* Guardar en DB */
    DB.update('resources', resourceId, {
      link_status: result.status,
      link_http_code: result.httpCode,
      link_checked_at: new Date().toISOString()
    });

    return result;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     VERIFICACION MASIVA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Verifica todos los recursos activos con concurrencia controlada.
   * Muestra progreso en vivo y resumen al finalizar.
   * @returns {Promise<void>}
   */
  async function verifyAll() {
    if (_isRunning) {
      console.warn('[LinkChecker] Ya hay una verificacion en curso. Cancela primero.');
      return;
    }

    const resources = DB.getAll('resources').filter(r => r.status === 'active' && r.url);
    if (resources.length === 0) {
      _showSummary({ ok: 0, redirect: 0, broken: 0, unknown: 0, total: 0 });
      return;
    }

    _isRunning = true;
    _abortController = new AbortController();
    _hostLastRequest = {};

    const stats = { ok: 0, redirect: 0, broken: 0, unknown: 0, total: resources.length };
    let processed = 0;

    _showProgress(processed, stats.total, 'Iniciando verificacion...');

    try {
      /* Procesar en lotes de MAX_CONCURRENT */
      for (let i = 0; i < resources.length; i += MAX_CONCURRENT) {
        if (_abortController.signal.aborted) {
          console.log('[LinkChecker] Verificacion cancelada por el usuario.');
          break;
        }

        const batch = resources.slice(i, i + MAX_CONCURRENT);
        const promises = batch.map(r => _verifyOneWithProgress(r, stats, () => {
          processed++;
          _showProgress(processed, stats.total, `${processed}/${stats.total} verificados`);
        }));

        await Promise.all(promises);
      }
    } catch (err) {
      console.error('[LinkChecker] Error en verifyAll():', err);
    } finally {
      _isRunning = false;
      _abortController = null;
      _showSummary(stats);
    }
  }

  /**
   * Cancela la verificacion masiva en curso.
   */
  function cancel() {
    if (_abortController && !_abortController.signal.aborted) {
      _abortController.abort();
      console.log('[LinkChecker] Cancelacion solicitada.');
    }
  }

  /**
   * Verifica un recurso individual y actualiza estadisticas.
   * @private
   */
  async function _verifyOneWithProgress(resource, stats, onProgress) {
    try {
      /* Rate limit por host */
      const hostname = _extractHostname(resource.url);
      await _waitForHost(hostname);

      if (_abortController && _abortController.signal.aborted) return;

      const result = await _checkUrl(resource.url);

      /* Actualizar DB */
      DB.update('resources', resource.id, {
        link_status: result.status,
        link_http_code: result.httpCode,
        link_checked_at: new Date().toISOString()
      });

      /* Contar estadisticas */
      if (stats[result.status] !== undefined) {
        stats[result.status]++;
      }

    } catch (err) {
      if (err.name === 'AbortError') return;

      /* Timeout / error de red -> unknown */
      DB.update('resources', resource.id, {
        link_status: 'unknown',
        link_http_code: null,
        link_checked_at: new Date().toISOString()
      });
      stats.unknown++;
      console.warn(`[LinkChecker] Error verificando ${resource.url}:`, err.message);
    } finally {
      onProgress();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CHECK HTTP DE UNA URL (core)
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Realiza la peticion HTTP y clasifica la respuesta.
   * Estrategia CORS:
   *   1. HEAD con mode: no-cors (respuesta opaca, no podemos leer status)
   *   2. Si no hay proxy CORS configurado -> unknown (no podemos distinguir)
   *   3. Si hay proxy CORS configurado -> usar proxy
   * @private
   */
  async function _checkUrl(url) {
    /* --- Verificar si hay proxy CORS configurado --- */
    const proxyUrl = _getCorsProxy();

    if (proxyUrl) {
      /* Usar proxy CORS */
      return _checkViaProxy(url, proxyUrl);
    }

    /* --- Sin proxy: intentar directo con no-cors --- */
    return _checkDirectNoCors(url);
  }

  /**
   * Verificacion via proxy CORS.
   * @private
   */
  async function _checkViaProxy(url, proxyUrl) {
    const targetUrl = proxyUrl + encodeURIComponent(url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT }
      });

      clearTimeout(timeoutId);
      return _classifyResponse(response, url);

    } catch (err) {
      clearTimeout(timeoutId);

      /* Si HEAD falla (405), reintentar con GET */
      if (err.message && err.message.includes('405')) {
        return _checkWithGet(targetUrl, true);
      }

      /* Si falla con proxy, intentar sin proxy */
      return _checkDirectNoCors(url);
    }
  }

  /**
   * Verificacion directa con mode: no-cors.
   * La respuesta sera opaca (status = 0), asi que no podemos
   * distinguir entre OK y error. Marcamos como 'unknown'.
   * @private
   */
  async function _checkDirectNoCors(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      /* Intentar HEAD primero */
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT }
      });

      clearTimeout(timeoutId);

      /* En modo no-cors la respuesta es opaca - no podemos leer status */
      /* Intentamos un fetch con cors para ver si funciona */
      return _checkDirectCors(url);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { status: 'unknown', httpCode: null };
      }

      /* HEAD fallo - intentar GET */
      return _checkDirectCors(url);
    }
  }

  /**
   * Intenta fetch con cors mode (sin no-cors).
   * Si funciona, podemos leer el status real.
   * Si falla por CORS, marcamos como unknown (no broken).
   * @private
   */
  async function _checkDirectCors(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT }
      });

      clearTimeout(timeoutId);
      return _classifyResponse(response, url);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { status: 'unknown', httpCode: null };
      }

      /* Error CORS o de red -> unknown (no podemos confirmar que este roto) */
      /* Intentar con GET + abort al recibir headers */
      return _checkWithGet(url, false);
    }
  }

  /**
   * Reintenta con GET y aborta al recibir los headers.
   * @private
   * @param {string} url
   * @param {boolean} viaProxy - si true, url ya incluye el proxy
   */
  async function _checkWithGet(url, viaProxy) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const fetchUrl = viaProxy ? url : url;
      const response = await fetch(fetchUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          /* Pedir solo headers para no descargar el body completo */
          'Range': 'bytes=0-0'
        }
      });

      clearTimeout(timeoutId);
      return _classifyResponse(response, url);

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        return { status: 'unknown', httpCode: null };
      }

      /* No podemos determinar el estado real desde el navegador */
      return { status: 'unknown', httpCode: null };
    }
  }

  /**
   * Clasifica una respuesta HTTP en: ok, redirect, broken, unknown.
   * @private
   */
  function _classifyResponse(response, originalUrl) {
    const code = response.status;

    /* 2xx -> ok */
    if (code >= 200 && code < 300) {
      return { status: 'ok', httpCode: code };
    }

    /* 3xx -> redirect (verificar si cambia de dominio) */
    if (code >= 300 && code < 400) {
      const redirectUrl = response.headers.get('Location') || '';
      try {
        const originalHost = new URL(originalUrl).hostname;
        const redirectHost = new URL(redirectUrl).hostname;
        /* Si redirige a otro dominio, es redirect. Si es mismo dominio, ok. */
        if (redirectHost && redirectHost !== originalHost) {
          return { status: 'redirect', httpCode: code };
        }
        return { status: 'ok', httpCode: code };
      } catch {
        return { status: 'redirect', httpCode: code };
      }
    }

    /* 4xx/5xx -> broken */
    if (code >= 400) {
      /* 405 Method Not Allowed -> no es broken, es que no acepta HEAD */
      if (code === 405) {
        return { status: 'unknown', httpCode: code };
      }
      return { status: 'broken', httpCode: code };
    }

    /* Respuesta opaca u otro caso */
    return { status: 'unknown', httpCode: code };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ROBOTS.TXT
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Verifica robots.txt del dominio para comprobar si se permite
   * el acceso a nuestro user-agent.
   * @param {string} url
   * @returns {Promise<boolean>} true si se permite verificar
   */
  async function checkRobotsTxt(url) {
    try {
      const parsed = new URL(url);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(robotsUrl, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      /* En modo no-cors no podemos leer el body, asumimos permitido */
      /* Si llegamos aqui sin error, asumimos que esta permitido */
      return true;

    } catch (err) {
      /* Si no hay robots.txt o no es accesible, asumimos permitido */
      return true;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SSRF PROTECTION
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Valida si una URL es segura para verificar (SSRF protection).
   * Bloquea:
   *   - Rangos IPprivados
   *   - Protocolos no http/https
   *   - URLs con demasiadas redirecciones
   * @param {string} url
   * @returns {boolean}
   */
  function canCheckUrl(url) {
    try {
      const parsed = new URL(url);

      /* Solo http y https */
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.warn('[LinkChecker] SSRF: Protocolo no permitido:', parsed.protocol);
        return false;
      }

      /* Verificar si es IP privada */
      const hostname = parsed.hostname;

      /* IPv6 loopback y privadas */
      if (hostname === '::1' || hostname === '[::1]') {
        console.warn('[LinkChecker] SSRF: IPv6 loopback bloqueado');
        return false;
      }
      if (hostname.startsWith('fc') || hostname.startsWith('fd') ||
          hostname.startsWith('[fc') || hostname.startsWith('[fd')) {
        console.warn('[LinkChecker] SSRF: IPv6 privada bloqueada');
        return false;
      }

      /* localhost */
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.warn('[LinkChecker] SSRF: localhost bloqueado');
        return false;
      }

      /* Verificar IPv4 privadas */
      const ipNum = _ipv4ToNumber(hostname);
      if (ipNum !== null && _isPrivateIPv4(ipNum)) {
        console.warn('[LinkChecker] SSRF: IP privada bloqueada:', hostname);
        return false;
      }

      return true;

    } catch {
      console.warn('[LinkChecker] SSRF: URL invalida');
      return false;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UTILIDADES DE ESTADO / CSS
     ═══════════════════════════════════════════════════════════════════════ */

  function getStatusColor(status) {
    return (STATUS_MAP[status] || STATUS_MAP.unknown).color;
  }

  function getStatusDot(status) {
    return (STATUS_MAP[status] || STATUS_MAP.unknown).dot;
  }

  function getStatusLabel(status) {
    return (STATUS_MAP[status] || STATUS_MAP.unknown).label;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MANEJO DE LINKS ROTOS (UI)
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Muestra opciones para un link roto: archivar, editar, o pedir reemplazo IA.
   * @param {number} resourceId
   */
  function showBrokenOptions(resourceId) {
    const resource = DB.getById('resources', resourceId);
    if (!resource) return;

    const modalId = 'modal-broken-link';
    let $modal = document.getElementById(modalId);
    if ($modal) $modal.remove();

    $modal = document.createElement('div');
    $modal.id = modalId;
    $modal.className = 'modal-overlay';
    $modal.innerHTML = `
      <div class="modal">
        <header class="modal-header">
          <h3>Link roto detectado</h3>
          <button class="btn btn-ghost btn-sm modal-close" aria-label="Cerrar">&times;</button>
        </header>
        <div class="modal-body">
          <p><strong>${_esc(resource.title || 'Sin titulo')}</strong></p>
          <p class="text-muted">${_esc(resource.url)}</p>
          <p class="text-muted">HTTP ${_esc(String(resource.link_http_code || 'N/A'))}</p>
          <div class="broken-options" style="margin-top: 16px;">
            <button class="btn btn-ghost btn-block" data-action="archive" data-id="${resource.id}">
              Archivar este recurso
            </button>
            <button class="btn btn-ghost btn-block" data-action="edit" data-id="${resource.id}">
              Editar la URL
            </button>
            <button class="btn btn-primary btn-block" data-action="replace-ai" data-id="${resource.id}">
              Pedir reemplazo a IA
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild($modal);

    const closeModal = () => $modal.classList.add('hidden');
    $modal.querySelector('.modal-close').addEventListener('click', closeModal);
    $modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });

    /* Archivar */
    $modal.querySelector('[data-action="archive"]').addEventListener('click', () => {
      DB.update('resources', resourceId, { status: 'archived' });
      closeModal();
      /* Refrescar vista si Resources esta disponible */
      if (typeof Resources !== 'undefined' && Resources.render) Resources.render();
    });

    /* Editar URL */
    $modal.querySelector('[data-action="edit"]').addEventListener('click', () => {
      closeModal();
      _showEditUrlModal(resourceId);
    });

    /* Pedir reemplazo a IA */
    $modal.querySelector('[data-action="replace-ai"]').addEventListener('click', () => {
      const queueItem = {
        title: `[Reemplazo] ${resource.title || 'Recurso'}`,
        url: resource.url,
        description: `Solicitud de reemplazo para recurso roto: ${resource.title}. HTTP ${resource.link_http_code || 'N/A'}`,
        category: resource.category || 'blog',
        phase: resource.phase,
        phase_suggested: resource.phase,
        category_suggested: resource.category,
        reason: `Link roto detectado (HTTP ${resource.link_http_code || 'N/A'}). Solicitud automatica de reemplazo.`,
        confidence: 1.0,
        model: 'LinkChecker',
        status: 'pending',
        found_by: 'link_checker'
      };
      DB.insert('resource_queue', queueItem);
      closeModal();
      /* Actualizar badge de cola */
      if (typeof Queue !== 'undefined' && Queue.renderBadge) Queue.renderBadge();
      alert('Solicitud de reemplazo enviada a la cola de IA.');
    });
  }

  /**
   * Muestra advertencia CORS cuando no hay proxy configurado.
   */
  function showCorsWarning() {
    const existing = document.getElementById('link-checker-cors-warning');
    if (existing) return;

    const $banner = document.createElement('div');
    $banner.id = 'link-checker-cors-warning';
    $banner.className = 'banner banner-warning';
    $banner.innerHTML = `
      <span class="banner-icon">⚠️</span>
      <span class="banner-text">
        <strong>Limitacion CORS:</strong> Desde el navegador no se puede verificar el estado HTTP real de enlaces externos.
        Los resultados se marcaran como "Sin verificar". Configura un proxy CORS para verificacion completa.
      </span>
      <button class="banner-close" aria-label="Cerrar">&times;</button>
    `;

    const container = document.getElementById('recursos') || document.body;
    container.insertBefore($banner, container.firstChild);

    $banner.querySelector('.banner-close').addEventListener('click', () => {
      $banner.remove();
    });
  }

  /**
   * Oculta la advertencia CORS.
   */
  function hideCorsWarning() {
    const banner = document.getElementById('link-checker-cors-warning');
    if (banner) banner.remove();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS PRIVADOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Extrae el hostname de una URL.
   * @private
   */
  function _extractHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
 /**
   * Espera el delay necesario para respetar el rate-limit por host.
   * @private
   */
  async function _waitForHost(hostname) {
    const now = Date.now();
    const last = _hostLastRequest[hostname] || 0;
    const wait = Math.max(0, HOST_DELAY_MS - (now - last));

    if (wait > 0) {
      await _sleep(wait);
    }

    _hostLastRequest[hostname] = Date.now();
  }

  /**
   * Promise-based sleep.
   * @private
   */
  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convierte IPv4 string a numero de 32 bits.
   * @private
   * @returns {number|null}
   */
  function _ipv4ToNumber(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    const nums = parts.map(Number);
    if (nums.some(n => Number.isNaN(n) || n < 0 || n > 255)) return null;
    return (nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3];
  }

  /**
   * Verifica si una IP numerica esta en rango privado.
   * @private
   */
  function _isPrivateIPv4(ipNum) {
    for (let i = 0; i < PRIVATE_IPV4.length; i++) {
      const range = PRIVATE_IPV4[i];
      const mask = 0xFFFFFFFF << (32 - range.mask);
      if ((ipNum & mask) === (range.start & mask)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Obtiene la URL del proxy CORS configurado (si existe).
   * @private
   */
  function _getCorsProxy() {
    /* Buscar en configuracion de la app */
    if (typeof App !== 'undefined' && App.config && App.config.corsProxy) {
      return App.config.corsProxy;
    }
    /* Buscar en localStorage */
    try {
      const stored = localStorage.getItem('bitacora_cors_proxy');
      if (stored) return stored;
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Escapa HTML.
   * @private
   */
  function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Muestra el progreso de verificacion en el DOM.
   * @private
   */
  function _showProgress(current, total, message) {
    /* Buscar o crear barra de progreso */
    let $progress = document.getElementById('link-checker-progress');
    if (!$progress) {
      $progress = document.createElement('div');
      $progress.id = 'link-checker-progress';
      $progress.className = 'link-checker-progress';

      const container = document.getElementById('recursos');
      if (container) {
        container.insertBefore($progress, container.firstChild);
      } else {
        document.body.appendChild($progress);
      }
    }

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    $progress.innerHTML = `
      <div class="lc-progress-bar">
        <div class="lc-progress-fill" style="width: ${pct}%"></div>
      </div>
      <div class="lc-progress-info">
        <span class="lc-progress-text">${message}</span>
        <button class="btn btn-ghost btn-sm" id="lc-cancel-btn">Cancelar</button>
      </div>
    `;

    $progress.classList.remove('hidden');

    const $cancelBtn = document.getElementById('lc-cancel-btn');
    if ($cancelBtn) {
      $cancelBtn.addEventListener('click', cancel);
    }
  }

  /**
   * Muestra el resumen de verificacion y oculta la barra de progreso.
   * @private
   */
  function _showSummary(stats) {
    /* Ocultar barra de progreso */
    const $progress = document.getElementById('link-checker-progress');
    if ($progress) {
      $progress.classList.add('hidden');
    }

    const parts = [];
    if (stats.ok > 0)       parts.push(`${stats.ok} ok`);
    if (stats.redirect > 0) parts.push(`${stats.redirect} redirigido${stats.redirect > 1 ? 's' : ''}`);
    if (stats.broken > 0)   parts.push(`${stats.broken} roto${stats.broken > 1 ? 's' : ''}`);
    if (stats.unknown > 0)  parts.push(`${stats.unknown} sin verificar`);

    const summaryText = parts.join(' · ') || 'Sin resultados';

    /* Mostrar resumen como notificacion */
    let $summary = document.getElementById('link-checker-summary');
    if (!$summary) {
      $summary = document.createElement('div');
      $summary.id = 'link-checker-summary';
      $summary.className = 'link-checker-summary';
      const container = document.getElementById('recursos');
      if (container) {
        container.insertBefore($summary, container.firstChild);
      } else {
        document.body.appendChild($summary);
      }
    }

    $summary.innerHTML = `
      <span class="lc-summary-text">${summaryText}</span>
      <button class="btn btn-ghost btn-sm lc-summary-close" aria-label="Cerrar">&times;</button>
    `;
    $summary.classList.remove('hidden');

    $summary.querySelector('.lc-summary-close').addEventListener('click', () => {
      $summary.classList.add('hidden');
    });

    /* Auto-ocultar despues de 8 segundos */
    setTimeout(() => {
      if ($summary) $summary.classList.add('hidden');
    }, 8000);

    console.log('[LinkChecker] Resumen:', summaryText);

    /* Refrescar vista de recursos */
    if (typeof Resources !== 'undefined' && Resources.render) {
      Resources.render();
    }
  }

  /**
   * Muestra modal para editar la URL de un recurso.
   * @private
   */
  function _showEditUrlModal(resourceId) {
    const resource = DB.getById('resources', resourceId);
    if (!resource) return;

    const modalId = 'modal-edit-url';
    let $modal = document.getElementById(modalId);
    if ($modal) $modal.remove();

    $modal = document.createElement('div');
    $modal.id = modalId;
    $modal.className = 'modal-overlay';
    $modal.innerHTML = `
      <div class="modal">
        <header class="modal-header">
          <h3>Editar URL</h3>
          <button class="btn btn-ghost btn-sm modal-close" aria-label="Cerrar">&times;</button>
        </header>
        <form class="modal-body" id="form-edit-url">
          <div class="form-group">
            <label for="edit-url-field">Nueva URL</label>
            <input type="url" id="edit-url-field" name="url" required
                   value="${_esc(resource.url || '')}" placeholder="https://...">
          </div>
          <p class="text-muted">URL anterior: ${_esc(resource.url || '')}</p>
        </form>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" form="form-edit-url">Guardar y verificar</button>
        </footer>
      </div>
    `;

    document.body.appendChild($modal);

    const closeModal = () => $modal.classList.add('hidden');
    $modal.querySelector('.modal-close').addEventListener('click', closeModal);
    $modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    $modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });

    $modal.querySelector('#form-edit-url').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const newUrl = fd.get('url')?.trim();
      if (!newUrl) return;

      try {
        new URL(newUrl); /* validar */
      } catch {
        alert('URL invalida');
        return;
      }

      DB.update('resources', resourceId, {
        url: newUrl,
        link_status: 'unknown',
        link_http_code: null,
        link_checked_at: null
      });

      closeModal();

      /* Verificar el nuevo link */
      await verifyOne(resourceId);

      /* Refrescar vista */
      if (typeof Resources !== 'undefined' && Resources.render) Resources.render();
    });
  }
  /* ═══════════════════════════════════════════════════════════════════════
     API PUBLICA
     ═══════════════════════════════════════════════════════════════════════ */

  return {
    init,
    verifyOne,
    verifyAll,
    cancel,
    checkRobotsTxt,
    canCheckUrl,
    getStatusColor,
    getStatusDot,
    getStatusLabel,
    showBrokenOptions,
    showCorsWarning,
    hideCorsWarning,
    /* Exponer estado para debug */
    get isRunning() { return _isRunning; }
  };

})();