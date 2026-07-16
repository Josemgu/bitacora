/**
 * ============================================================================
 * BITACORA - app.js
 * Nucleo de integracion. Orquestador de la aplicacion.
 * ============================================================================
 * Dependencias cargadas previamente:
 *   SEED_DATA, DB, Roadmap, Resources, AIChat, LinkChecker,
 *   Discover, Queue, Health, Projects, Config
 * ============================================================================
 */

const App = (function () {
  'use strict';

  /* ================================================================
     ESTADO GLOBAL
  ================================================================ */
  const state = {
    currentView: 'inicio',
    previousView: null,
    sidebarOpen: false,
    currentPhase: null,
    currentTopic: null,
    isOnline: true,
    searchDebounceTimer: null,
    chatInitialized: false,
    colaViewCreated: false,
    modulesReady: {}
  };

  /* ================================================================
     UTILIDADES
  ================================================================ */

  /**
   * Escapa caracteres HTML para prevenir XSS.
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Debounce utility.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /**
   * Formatea una fecha a formato legible en espanol.
   * @param {Date|string} date
   * @returns {string}
   */
  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'Fecha invalida';
    const opciones = { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('es-ES', opciones);
  }

  /**
   * Retorna tiempo relativo: "hace 2h", "hace 3d", "ahora".
   * @param {Date|string} date
   * @returns {string}
   */
  function relativeTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 30) return 'ahora';
    if (diffMin < 1) return `hace ${diffSec}s`;
    if (diffMin < 60) return `hace ${diffMin}m`;
    if (diffHour < 24) return `hace ${diffHour}h`;
    if (diffDay < 30) return `hace ${diffDay}d`;
    return formatDate(d);
  }

  /**
   * Obtiene un elemento del DOM de forma segura.
   * @param {string} selector
   * @returns {Element|null}
   */
  function $(selector) {
    return document.querySelector(selector);
  }

  /**
   * Obtiene multiples elementos del DOM.
   * @param {string} selector
   * @returns {NodeList}
   */
  function $$(selector) {
    return document.querySelectorAll(selector);
  }

  /* ================================================================
     HASH / URL PARSING
  ================================================================ */

  /**
   * Extrae el nombre de la vista del hash.
   * #roadmap -> "roadmap"
   * #recursos?q=linux -> "recursos"
   * '' -> "inicio"
   * @returns {string}
   */
  function getHashView() {
    const hash = window.location.hash || '#inicio';
    const clean = hash.replace(/^#/, '');
    const viewName = clean.split(/[/?]/)[0];
    return viewName || 'inicio';
  }

  /**
   * Extrae query params del hash.
   * #recursos?q=linux&phase=F1 -> { q: 'linux', phase: 'F1' }
   * @returns {Object}
   */
  function getHashParams() {
    const hash = window.location.hash || '';
    const params = {};
    const queryIndex = hash.indexOf('?');
    if (queryIndex === -1) return params;

    const queryString = hash.slice(queryIndex + 1);
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    }
    return params;
  }

  /* ================================================================
     FASE / TEMA ACTUAL
  ================================================================ */

  /**
   * Retorna la fase actual basada en DB.
   * @returns {Object|null}
   */
  function getCurrentPhase() {
    const db = (typeof DB !== 'undefined' && DB.get) ? DB.get() : null;
    if (!db || !db.phases) return null;

    // Buscar fase con algun topic en status 'current'
    for (const phase of db.phases) {
      if (phase.topics && phase.topics.some(t => t.status === 'current')) {
        return phase;
      }
    }
    // Si no hay, buscar primera fase con status 'current' o 'todo'
    for (const phase of db.phases) {
      if (phase.status === 'current' || phase.status === 'todo') {
        return phase;
      }
    }
    // Ultimo recurso: primera fase
    return db.phases[0] || null;
  }

  /**
   * Retorna el tema en curso (status 'current').
   * Solo debe haber uno.
   * @returns {Object|null}
   */
  function getCurrentTopic() {
    const db = (typeof DB !== 'undefined' && DB.get) ? DB.get() : null;
    if (!db || !db.phases) return null;

    for (const phase of db.phases) {
      if (phase.topics) {
        for (const topic of phase.topics) {
          if (topic.status === 'current') {
            return { ...topic, phaseId: phase.id, phaseName: phase.name };
          }
        }
      }
    }
    return null;
  }

  /* ================================================================
     PROGRESO GLOBAL
  ================================================================ */

  /**
   * Calcula y actualiza los indicadores de progreso global.
   */
  function updateProgress() {
    const db = (typeof DB !== 'undefined' && DB.get) ? DB.get() : null;
    if (!db || !db.phases) return;

    let totalTopics = 0;
    let doneTopics = 0;
    let currentPhaseIndex = 0;
    let totalPhases = db.phases.length;

    db.phases.forEach((phase, idx) => {
      if (phase.topics) {
        phase.topics.forEach(topic => {
          totalTopics++;
          if (topic.status === 'done') doneTopics++;
        });
      }
      if (phase.status === 'current') {
        currentPhaseIndex = idx + 1;
      }
    });

    const pct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;

    // Actualizar sidebar progress bar
    const barFill = $('.bar-fill');
    if (barFill) barFill.style.width = pct + '%';

    // Actualizar porcentaje en texto
    const pctEl = $('.mini-progress-head strong');
    if (pctEl) pctEl.textContent = pct + '%';

    // Actualizar nota "Fase X de Y"
    const noteEl = $('.mini-progress-note');
    if (noteEl) {
      noteEl.textContent = `Fase ${currentPhaseIndex} de ${totalPhases}`;
    }

    // Actualizar status pill del header
    const statusPill = $('.status-pill');
    if (statusPill) {
      const phase = getCurrentPhase();
      const topic = getCurrentTopic();
      if (phase && topic) {
        statusPill.innerHTML = `<span>${phase.id}</span> <span>EN CURSO</span>`;
        statusPill.title = `${phase.name}: ${topic.name}`;
      } else if (phase) {
        statusPill.innerHTML = `<span>${phase.id}</span> <span>SYNC</span>`;
      } else {
        statusPill.innerHTML = `<span>F1</span> <span>SYNC</span>`;
      }
    }

    // Refrescar roadmap visual
    if (typeof Roadmap !== 'undefined') {
      if (Roadmap.refreshStrip) Roadmap.refreshStrip();
      if (Roadmap.refreshSpine) Roadmap.refreshSpine();
    }
  }

  /* ================================================================
     SIDEBAR
  ================================================================ */

  /**
   * Marca el nav-item activo segun la vista actual.
   * Actualiza badges y progress.
   */
  function updateSidebar() {
    const viewName = state.currentView;

    // Quitar is-active de todos los nav-items
    $$('.nav-item').forEach(item => item.classList.remove('is-active'));

    // Activar el que corresponde
    const activeItem = $(`.nav-item[data-view="${viewName}"]`);
    if (activeItem) activeItem.classList.add('is-active');

    // Actualizar badge de cola
    if (typeof Queue !== 'undefined' && Queue.renderBadge) {
      Queue.renderBadge();
    }

    // Actualizar progress
    updateProgress();
  }

  /**
   * Toggle sidebar en movil.
   */
  function toggleSidebar() {
    const sidebar = $('.sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('is-open');
    state.sidebarOpen = sidebar.classList.contains('is-open');
  }

  /**
   * Cierra el sidebar (modo movil).
   */
  function closeSidebar() {
    const sidebar = $('.sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    state.sidebarOpen = false;
  }

  /* ================================================================
     VISTAS
  ================================================================ */

  const views = {};

  // ---------- INICIO (Dashboard) ----------
  views.inicio = function () {
    const db = (typeof DB !== 'undefined' && DB.get) ? DB.get() : null;
    if (!db) return;

    const phase = getCurrentPhase();
    const topic = getCurrentTopic();

    // --- Hero: fase actual ---
    const heroPhase = $('.hero-phase');
    const heroTopic = $('.hero-topic');
    const heroStatus = $('.hero-status');

    if (heroPhase) {
      heroPhase.textContent = phase ? `${phase.id}: ${phase.name}` : 'Sin fase activa';
    }
    if (heroTopic) {
      heroTopic.textContent = topic ? topic.name : 'Sin tema en curso';
    }
    if (heroStatus) {
      heroStatus.textContent = topic ? 'EN CURSO' : (phase ? phase.status.toUpperCase() : 'SYNC');
    }

    // --- Stats ---
    let totalTopics = 0, doneTopics = 0, hoursTotal = 0, videosTotal = 0;
    let streakDays = db.streakDays || 0;

    if (db.phases) {
      db.phases.forEach(ph => {
        if (ph.topics) {
          ph.topics.forEach(t => {
            totalTopics++;
            if (t.status === 'done') doneTopics++;
            hoursTotal += t.hours || 0;
            videosTotal += t.videos || 0;
          });
        }
      });
    }

    // Actualizar stat-row
    const statEls = $$('.stat-row .stat-value');
    if (statEls.length >= 4) {
      statEls[0].textContent = streakDays + (streakDays === 1 ? ' dia' : ' dias');
      statEls[1].textContent = hoursTotal + 'h';
      statEls[2].textContent = (totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0) + '%';
      statEls[3].textContent = videosTotal;
    }

    // --- Panel "Fase actual" ---
    const currentPhasePanel = $('.panel-fase-actual .panel-body');
    if (currentPhasePanel && phase && phase.topics) {
      const currentTopics = phase.topics.filter(t => t.status === 'current' || t.status === 'todo').slice(0, 5);
      if (currentTopics.length === 0) {
        currentPhasePanel.innerHTML = '<p class="empty-state">Todos los temas completados en esta fase.</p>';
      } else {
        currentPhasePanel.innerHTML = currentTopics.map(t => {
          const statusClass = t.status === 'current' ? 'status-current' : 'status-todo';
          const statusLabel = t.status === 'current' ? 'En curso' : 'Pendiente';
          return `
            <div class="topic-row ${statusClass}">
              <span class="topic-name">${escapeHtml(t.name)}</span>
              <span class="topic-meta">${t.hours || 0}h · ${statusLabel}</span>
            </div>
          `;
        }).join('');
      }
    }

    // --- Panel "Esta semana" ---
    const weekPanel = $('.panel-semana .panel-body');
    if (weekPanel && db.schedule) {
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
      const hoy = new Date().getDay();
      const diasOrdenados = [];
      for (let i = 0; i < 7; i++) {
        const idx = (hoy + i) % 7;
        diasOrdenados.push(diasSemana[idx]);
      }

      weekPanel.innerHTML = diasOrdenados.slice(0, 5).map((dia, i) => {
        const diaData = db.schedule.find(s => s.day === dia);
        const isToday = i === 0;
        const topics = diaData ? diaData.topics : [];
        return `
          <div class="week-day ${isToday ? 'is-today' : ''}">
            <span class="week-day-name">${dia}${isToday ? ' (hoy)' : ''}</span>
            <div class="week-day-topics">
              ${topics.length > 0
                ? topics.map(t => `<span class="week-topic">${escapeHtml(t)}</span>`).join('')
                : '<span class="week-topic week-topic--rest">Descanso</span>'
              }
            </div>
          </div>
        `;
      }).join('');
    }
  };

  // ---------- ROADMAP ----------
  views.roadmap = function () {
    if (typeof Roadmap !== 'undefined' && Roadmap.render) {
      Roadmap.render();
    }
  };

  // ---------- RECURSOS ----------
  views.recursos = function () {
    if (typeof Resources !== 'undefined' && Resources.render) {
      Resources.render();
    }
    // Aplicar query params (filtros iniciales)
    const params = getHashParams();
    if (params.q && typeof Resources !== 'undefined' && Resources.filterData) {
      const searchInput = $('.topbar-search');
      if (searchInput) searchInput.value = params.q;
      Resources.filterData(params.q);
    }
    if (params.phase && typeof Resources !== 'undefined' && Resources.filterByPhase) {
      Resources.filterByPhase(params.phase);
    }
  };

  // ---------- HORARIO ----------
  views.horario = function () {
    const db = (typeof DB !== 'undefined' && DB.get) ? DB.get() : null;
    const viewBody = $('#view-horario .view-body');
    if (!viewBody) return;

    const diasSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
    const hoyIdx = (new Date().getDay() + 6) % 7; // 0=Lunes
    const schedule = (db && db.schedule) ? db.schedule : [];

    viewBody.innerHTML = `
      <div class="schedule-grid">
        ${diasSemana.map((dia, idx) => {
          const diaData = schedule.find(s => s.day === dia);
          const isToday = idx === hoyIdx;
          const topics = diaData ? diaData.topics : [];
          return `
            <div class="schedule-card ${isToday ? 'is-today' : ''}">
              <div class="schedule-card-header">
                <span class="schedule-day">${dia}</span>
                ${isToday ? '<span class="schedule-today-badge">HOY</span>' : ''}
              </div>
              <div class="schedule-card-body">
                ${topics.length > 0
                  ? `<ul class="schedule-topic-list">
                      ${topics.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                    </ul>`
                  : '<p class="schedule-rest">Dia de descanso</p>'
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // ---------- MESA ----------
  views.mesa = function () {
    const viewBody = $('#view-mesa .view-body');
    if (!viewBody) return;

    // Solo renderizar si el canvas no existe aun
    if (viewBody.querySelector('.work-canvas')) return;

    viewBody.innerHTML = `
      <div class="mesa-container">
        <canvas id="work-canvas" class="work-canvas" width="1200" height="800"></canvas>
        <div class="mesa-tools">
          <button class="mesa-tool" data-tool="pen" title="Lapiz">✏️</button>
          <button class="mesa-tool" data-tool="eraser" title="Borrador">🧹</button>
          <button class="mesa-tool" data-tool="clear" title="Limpiar">🗑️</button>
          <button class="mesa-tool" data-tool="save" title="Guardar">💾</button>
        </div>
      </div>
    `;

    // Inicializar canvas minimo
    initMesaCanvas();
  };

  /**
   * Inicializa el canvas interactivo de la mesa de trabajo.
   */
  function initMesaCanvas() {
    const canvas = document.getElementById('work-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let currentTool = 'pen';

    // Ajustar canvas al contenedor
    function resizeCanvas() {
      const container = canvas.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width - 80; // espacio para tools
      canvas.height = rect.height;
    }
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 200));

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX || e.touches[0].clientX) - rect.left,
        y: (e.clientY || e.touches[0].clientY) - rect.top
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      if (currentTool === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!drawing) return;
      const pos = getPos(e);
      if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 2;
      }
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });

    canvas.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('mouseleave', () => { drawing = false; });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (currentTool === 'clear') { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!drawing) return;
      const pos = getPos(e);
      if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 2;
      }
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { drawing = false; });

    // Tool buttons
    const tools = canvas.parentElement.querySelectorAll('.mesa-tool');
    tools.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'clear') {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        } else if (tool === 'save') {
          const link = document.createElement('a');
          link.download = 'bitacora-mesa-' + new Date().toISOString().slice(0, 10) + '.png';
          link.href = canvas.toDataURL();
          link.click();
        } else {
          currentTool = tool;
          tools.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        }
      });
    });
    if (tools[0]) tools[0].classList.add('is-active');
  }

  // ---------- CHAT ----------
  views.chat = function () {
    if (!state.chatInitialized && typeof AIChat !== 'undefined') {
      AIChat.init();
      state.chatInitialized = true;
    }
    // Enfocar input
    setTimeout(() => {
      const input = $('.chat-input');
      if (input) input.focus();
    }, 100);
  };

  // ---------- SISTEMA ----------
  views.sistema = function () {
    if (typeof Health !== 'undefined') {
      if (Health.renderStatus) Health.renderStatus();
      if (Health.renderActivity) Health.renderActivity();
    }
    if (typeof Profile !== 'undefined' && Profile.render) {
      Profile.render();
    }
  };

  // ---------- CONFIG ----------
  views.config = function () {
    if (typeof Config !== 'undefined' && Config.render) {
      Config.render();
    }
  };

  // ---------- COLA ----------
  views.cola = function () {
    if (!state.colaViewCreated) {
      const main = $('.main');
      if (!main) return;
      let colaSection = $('#view-cola');
      if (!colaSection) {
        colaSection = document.createElement('section');
        colaSection.className = 'view';
        colaSection.id = 'view-cola';
        colaSection.innerHTML = `
          <div class="view-bar">
            <span class="crumb">Cola de aprobacion</span>
            <span class="view-bar-meta">Recursos pendientes por revisar</span>
          </div>
          <div class="view-body">
            <div class="queue-container"></div>
          </div>
        `;
        main.appendChild(colaSection);
      }
      state.colaViewCreated = true;
    }
    if (typeof Queue !== 'undefined' && Queue.render) {
      Queue.render();
    }
  };

  // ---------- IMPORTAR ROADMAP ----------
  views.import = function () {
    if (typeof ImportRoadmap !== 'undefined' && ImportRoadmap.init) {
      ImportRoadmap.init();
    }
  };

  // ---------- GENERAR ROADMAP CON IA ----------
  views.generate = function () {
    if (typeof GenerateRoadmap !== 'undefined' && GenerateRoadmap.init) {
      GenerateRoadmap.init();
    }
  };

  // ---------- LABORATORIOS ----------
  views.labs = function () {
    if (typeof Labs !== 'undefined' && Labs.init) {
      Labs.init();
    }
  };

  // ---------- TUTORIALES ----------
  views.tutorials = function () {
    if (typeof Tutorials !== 'undefined' && Tutorials.init) {
      Tutorials.init();
    }
  };

  // ---------- MENSAJES ----------
  views.messages = function () {
    if (typeof Messages !== 'undefined' && Messages.init) {
      Messages.init();
    }
  };

  // ---------- NOTAS ----------
  views.notes = function () {
    if (typeof Notes !== 'undefined' && Notes.init) {
      Notes.init();
    }
  };

  /* ================================================================
     ROUTER
  ================================================================ */

  /**
   * Mapeo de nombres de vista a funcion de renderizado.
   */
  const VIEW_MAP = {
    inicio: views.inicio,
    roadmap: views.roadmap,
    recursos: views.recursos,
    horario: views.horario,
    mesa: views.mesa,
    chat: views.chat,
    sistema: views.sistema,
    config: views.config,
    cola: views.cola,
    import: views.import,
    generate: views.generate,
    labs: views.labs,
    tutorials: views.tutorials,
    messages: views.messages,
    notes: views.notes
  };

  /**
   * Maneja la navegacion por hash.
   */
  function router() {
    const hash = window.location.hash || '#inicio';
    const viewName = getHashView();
    const params = getHashParams();

    // Guardar vista anterior
    state.previousView = state.currentView;
    state.currentView = viewName;

    // Ocultar vista anterior
    const prevView = state.previousView ? $(`#view-${state.previousView}`) : null;
    if (prevView) prevView.classList.remove('is-visible');

    // Si la vista no existe en el mapa, default a inicio
    const viewFn = VIEW_MAP[viewName];
    if (!viewFn) {
      window.location.hash = '#inicio';
      return;
    }

    // Asegurar que el elemento DOM de la vista exista
    let viewEl = $(`#view-${viewName}`);

    // Para cola, crear dinamicamente
    if (viewName === 'cola' && !viewEl) {
      views.cola(); // Esto crea el elemento
      viewEl = $('#view-cola');
    }

    if (!viewEl) {
      console.warn(`[App] Vista #view-${viewName} no encontrada.`);
      window.location.hash = '#inicio';
      return;
    }

    // Mostrar nueva vista
    viewEl.classList.add('is-visible');

    // Actualizar sidebar
    updateSidebar();

    // Cerrar sidebar en movil
    closeSidebar();

    // Renderizar contenido de la vista
    try {
      viewFn(params);
    } catch (err) {
      console.error(`[App] Error renderizando vista "${viewName}":`, err);
    }

    // Scroll al inicio
    const main = $('.main');
    if (main) main.scrollTop = 0;

    // Cerrar modales si estan abiertos
    closeAllModals();
  }

  /**
   * Navega programaticamente a un hash.
   * @param {string} hash
   */
  function navigate(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    window.location.hash = hash;
    // hashchange disparara router()
  }

  /* ================================================================
     ATAJOS DE TECLADO
  ================================================================ */

  /**
   * Configura los atajos de teclado globales.
   */
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K -> enfocar busqueda
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = $('.topbar-search');
        if (searchInput) searchInput.focus();
        return;
      }

      // Escape -> cerrar modales, cerrar sidebar
      if (e.key === 'Escape') {
        closeAllModals();
        closeSidebar();
        // Blur en busqueda
        const searchInput = $('.topbar-search');
        if (searchInput && document.activeElement === searchInput) {
          searchInput.blur();
        }
        return;
      }

      // 1-9 -> navegar a vistas principales
      const navMap = {
        '1': 'inicio',
        '2': 'roadmap',
        '3': 'recursos',
        '4': 'horario',
        '5': 'mesa',
        '6': 'chat',
        '7': 'sistema',
        '8': 'config',
        '9': 'cola'
      };

      if (navMap[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // No interferir con inputs
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        navigate(navMap[e.key]);
      }
    });
  }

  /* ================================================================
     BUSQUEDA GLOBAL
  ================================================================ */

  /**
   * Configura la busqueda global con debounce.
   */
  function setupSearch() {
    const searchInput = $('.topbar-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce(() => {
      const query = searchInput.value.trim().toLowerCase();
      const viewName = state.currentView;

      if (viewName === 'recursos' && typeof Resources !== 'undefined' && Resources.filterData) {
        Resources.filterData(query);
      } else if (viewName === 'roadmap' && typeof Roadmap !== 'undefined' && Roadmap.filterTopics) {
        Roadmap.filterTopics(query);
      } else if (viewName === 'inicio') {
        // Busqueda global en dashboard: navegar a recursos con el query
        if (query.length > 2) {
          navigate('recursos?q=' + encodeURIComponent(query));
        }
      }
    }, 200));

    // Placeholder con atajo
    searchInput.placeholder = 'Buscar... (Ctrl+K)';
  }

  /* ================================================================
     MODALES
  ================================================================ */

  /**
   * Cierra todos los modales abiertos.
   */
  function closeAllModals() {
    $$('.modal.is-visible').forEach(modal => {
      modal.classList.remove('is-visible');
    });
    $$('.overlay.is-visible').forEach(overlay => {
      overlay.classList.remove('is-visible');
    });
  }

  /* ================================================================
     NAVEGACION POR CLICK (Sidebar)
  ================================================================ */

  /**
   * Configura los clicks en los nav-items del sidebar.
   */
  function setupNavClicks() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = item.dataset.view;
        if (viewName) {
          navigate(viewName);
        }
      });
    });

    // Toggle sidebar (movil)
    const menuToggle = $('.menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', toggleSidebar);
    }
  }

  /* ================================================================
     MONITOREO ONLINE / OFFLINE
  ================================================================ */

  /**
   * Configura deteccion de estado de red.
   */
  function setupNetworkMonitor() {
    state.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      state.isOnline = true;
      updateStatusPill();
    });

    window.addEventListener('offline', () => {
      state.isOnline = false;
      updateStatusPill();
    });
  }

  /**
   * Actualiza el status pill segun estado de red.
   */
  function updateStatusPill() {
    const statusPill = $('.status-pill');
    if (!statusPill) return;

    if (!state.isOnline) {
      statusPill.innerHTML = '<span>OFFLINE</span>';
      statusPill.classList.add('status-offline');
    } else {
      statusPill.classList.remove('status-offline');
      updateProgress();
    }
  }

  /* ================================================================
     INICIALIZACION
  ================================================================ */

  /**
   * Punto de entrada principal de la aplicacion.
   */
  function init() {
    console.log('[App] Inicializando Bitacora...');

    // Aplicar tema guardado
    const savedTheme = localStorage.getItem('bitacora_theme') || 'dark';
    document.documentElement.dataset.theme = savedTheme;
    const savedAccent = localStorage.getItem('bitacora_accent');
    if (savedAccent) {
      document.documentElement.style.setProperty('--green', savedAccent);
      document.documentElement.style.setProperty('--green-dim', savedAccent);
    }

    // Verificar que DB esta inicializado
    if (typeof DB !== 'undefined' && DB.init && !DB._initialized) {
      DB.init();
    }

    // Calcular fase y tema actual
    state.currentPhase = getCurrentPhase();
    state.currentTopic = getCurrentTopic();

    // Inicializar modulos (con manejo de errores individual)
    const modules = [
      { name: 'Roadmap', ns: Roadmap },
      { name: 'Resources', ns: Resources },
      { name: 'Queue', ns: Queue },
      { name: 'AIChat', ns: AIChat },
      { name: 'Health', ns: Health },
      { name: 'Config', ns: Config },
      { name: 'LinkChecker', ns: LinkChecker },
      { name: 'Discover', ns: Discover },
      { name: 'Projects', ns: Projects },
      { name: 'Profile', ns: Profile }
    ];

    modules.forEach(mod => {
      try {
        if (mod.ns && typeof mod.ns.init === 'function') {
          mod.ns.init();
          state.modulesReady[mod.name] = true;
          console.log(`[App] Modulo ${mod.name} inicializado.`);
        }
      } catch (err) {
        state.modulesReady[mod.name] = false;
        console.error(`[App] Error inicializando ${mod.name}:`, err);
      }
    });

    // Configurar router
    window.addEventListener('hashchange', router);

    // Configurar atajos de teclado
    setupKeyboard();

    // Configurar busqueda global
    setupSearch();

    // Configurar navegacion por click
    setupNavClicks();

    // Monitoreo de red
    setupNetworkMonitor();

    // Ejecutar router inicial
    const initialHash = window.location.hash;
    if (!initialHash || initialHash === '#') {
      window.location.hash = '#inicio';
    } else {
      router();
    }

    // Actualizar progress global
    updateProgress();

    // Iniciar monitoreo de health
    if (typeof Health !== 'undefined' && Health.startMonitoring) {
      Health.startMonitoring();
    }

    console.log('[App] Bitacora lista.');
  }

  /* ================================================================
     API PUBLICA
  ================================================================ */

  return {
    // Estado
    state,

    // Inicializacion
    init,

    // Router
    router,
    navigate,
    getHashView,
    getHashParams,

    // Vistas
    views,

    // Sidebar
    updateSidebar,
    toggleSidebar,
    closeSidebar,

    // Progreso
    updateProgress,
    getCurrentPhase,
    getCurrentTopic,

    // Atajos / Busqueda
    setupKeyboard,
    setupSearch,

    // Utilidades
    formatDate,
    relativeTime,
    escapeHtml,
    debounce
  };

})();

/* ================================================================
   PUNTO DE ENTRADA
   ================================================================ */
document.addEventListener('DOMContentLoaded', App.init);