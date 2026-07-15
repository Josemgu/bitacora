/**
 * ============================================================================
 * BITACORA - app.js
 * Nucleo de integracion. Orquestador de la aplicacion.
 * ============================================================================
 */

const App = (function () {
  'use strict';

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

  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'Fecha invalida';
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function relativeTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const diffSec = Math.floor((new Date() - d) / 1000);
    if (diffSec < 30) return 'ahora';
    if (diffSec < 60) return `hace ${diffSec}s`;
    if (diffSec < 3600) return `hace ${Math.floor(diffSec/60)}m`;
    if (diffSec < 86400) return `hace ${Math.floor(diffSec/3600)}h`;
    return `hace ${Math.floor(diffSec/86400)}d`;
  }

  function $(s) { return document.querySelector(s); }
  function $$(s) { return document.querySelectorAll(s); }

  function getHashView() {
    const hash = window.location.hash || '#inicio';
    return hash.replace(/^#/, '').split(/[/?]/)[0] || 'inicio';
  }

  function getHashParams() {
    const hash = window.location.hash || '';
    const qi = hash.indexOf('?');
    if (qi === -1) return {};
    const params = {};
    hash.slice(qi + 1).split('&').forEach(p => {
      const [k, v] = p.split('=');
      if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
    });
    return params;
  }

  function getCurrentPhase() {
    const phases = DB.getAll('phases');
    for (const p of phases) {
      const topics = DB.query('topics', t => t.phase_id === p.id);
      if (topics.some(t => t.status === 'current')) return p;
    }
    for (const p of phases) {
      if (p.status === 'current' || p.status === 'todo') return p;
    }
    return phases[0] || null;
  }

  function getCurrentTopic() {
    const topics = DB.getAll('topics');
    for (const t of topics) {
      if (t.status === 'current') return t;
    }
    return null;
  }

  function updateProgress() {
    const topics = DB.getAll('topics');
    const done = topics.filter(t => t.status === 'done').length;
    const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;
    const phases = DB.getAll('phases');
    let currentIdx = 0;
    phases.forEach((p, i) => {
      if (p.status === 'current') currentIdx = i + 1;
    });

    const barFill = $('.bar-fill');
    if (barFill) barFill.style.width = pct + '%';
    const pctEl = $('.mini-progress-head strong');
    if (pctEl) pctEl.textContent = pct + '%';
    const noteEl = $('.mini-progress-note');
    if (noteEl) noteEl.textContent = `Fase ${currentIdx} de ${phases.length}`;
  }

  function updateSidebar() {
    $$('.nav-item').forEach(item => item.classList.remove('is-active'));
    const activeItem = $(`.nav-item[data-view="${state.currentView}"]`);
    if (activeItem) activeItem.classList.add('is-active');
    if (typeof Queue !== 'undefined' && Queue.renderBadge) Queue.renderBadge();
    updateProgress();
  }

  function toggleSidebar() {
    const sidebar = $('.sidebar');
    if (sidebar) sidebar.classList.toggle('is-open');
  }

  function closeSidebar() {
    const sidebar = $('.sidebar');
    if (sidebar) sidebar.classList.remove('is-open');
  }

  function closeAllModals() {
    $$('.modal.is-visible').forEach(m => m.classList.remove('is-visible'));
  }

  /* ================================================================
     VISTAS
  ================================================================ */

  const views = {};

  views.inicio = function () {
    const phase = getCurrentPhase();
    const topic = getCurrentTopic();
    const heroPhase = $('.hero-phase');
    const heroTopic = $('.hero-topic');
    if (heroPhase) heroPhase.textContent = phase ? `Fase ${phase.index}: ${phase.title}` : 'Sin fase activa';
    if (heroTopic) heroTopic.textContent = topic ? topic.title : 'Sin tema en curso';

    const topics = DB.getAll('topics');
    const done = topics.filter(t => t.status === 'done').length;
    const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;
    const statEls = $$('.stat-value');
    if (statEls.length >= 4) {
      statEls[0].textContent = '15 dias';
      statEls[1].textContent = '120h';
      statEls[2].textContent = pct + '%';
      statEls[3].textContent = '24';
    }
  };

  views.roadmap = function () {
    if (typeof Roadmap !== 'undefined' && Roadmap.render) Roadmap.render();
  };

  views.recursos = function () {
    if (typeof Resources !== 'undefined' && Resources.render) Resources.render();
  };

  views.horario = function () {
    const viewBody = $('#view-horario .view-body');
    if (!viewBody) return;
    const dias = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
    const hoy = (new Date().getDay() + 6) % 7;
    viewBody.innerHTML = `
      <div class="week-cards">
        ${dias.map((d, i) => `
          <div class="day ${i >= 5 ? 'is-weekend' : ''} ${i === hoy ? 'is-today' : ''}">
            <span class="day-name">${d}${i === hoy ? ' (hoy)' : ''}</span>
            <strong>Estudio</strong>
            <span class="day-note">2h</span>
          </div>
        `).join('')}
      </div>`;
  };

  views.mesa = function () {
    const viewBody = $('#view-mesa .view-body');
    if (!viewBody || viewBody.querySelector('.empty')) return;
    viewBody.innerHTML = `
      <div class="empty">
        <svg class="ico empty-ico"><use href="#i-mesa"></use></svg>
        <p>Mesa de trabajo interactiva. Usa el canvas para dibujar diagramas y tomar notas visuales.</p>
        <span class="empty-hint">Proximamente: canvas interactivo con herramientas de dibujo.</span>
      </div>`;
  };

  views.chat = function () {
    if (!state.chatInitialized && typeof AIChat !== 'undefined') {
      AIChat.init();
      state.chatInitialized = true;
    }
  };

  views.sistema = function () {
    if (typeof Health !== 'undefined') {
      if (Health.renderStatus) Health.renderStatus();
      if (Health.renderActivity) Health.renderActivity();
    }
    if (typeof Profile !== 'undefined' && Profile.render) Profile.render();
  };

  views.config = function () {
    if (typeof Config !== 'undefined' && Config.render) Config.render();
  };

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
          </div>`;
        main.appendChild(colaSection);
      }
      state.colaViewCreated = true;
    }
    if (typeof Queue !== 'undefined' && Queue.render) Queue.render();
  };

  views.import = function () {
    if (typeof ImportRoadmap !== 'undefined' && ImportRoadmap.init) ImportRoadmap.init();
  };

  views.generate = function () {
    if (typeof GenerateRoadmap !== 'undefined' && GenerateRoadmap.init) GenerateRoadmap.init();
  };

  views.labs = function () {
    if (typeof Labs !== 'undefined' && Labs.init) Labs.init();
  };

  views.tutorials = function () {
    if (typeof Tutorials !== 'undefined' && Tutorials.init) Tutorials.init();
  };

  views.messages = function () {
    if (typeof Messages !== 'undefined' && Messages.init) Messages.init();
  };

  views.notes = function () {
    if (typeof Notes !== 'undefined' && Notes.init) Notes.init();
  };

  /* ================================================================
     ROUTER
  ================================================================ */

  const VIEW_MAP = {
    inicio: views.inicio, roadmap: views.roadmap, recursos: views.recursos,
    horario: views.horario, mesa: views.mesa, chat: views.chat,
    sistema: views.sistema, config: views.config, cola: views.cola,
    import: views.import, generate: views.generate, labs: views.labs,
    tutorials: views.tutorials, messages: views.messages, notes: views.notes
  };

  function router() {
    const viewName = getHashView();
    state.previousView = state.currentView;
    state.currentView = viewName;

    const prevView = state.previousView ? $(`#view-${state.previousView}`) : null;
    if (prevView) prevView.classList.remove('is-visible');

    const viewFn = VIEW_MAP[viewName];
    if (!viewFn) { window.location.hash = '#inicio'; return; }

    if (viewName === 'cola' && !state.colaViewCreated) views.cola();

    let viewEl = $(`#view-${viewName}`);
    if (!viewEl) { window.location.hash = '#inicio'; return; }

    viewEl.classList.add('is-visible');
    updateSidebar();
    closeSidebar();
    try { viewFn(getHashParams()); } catch (err) { console.error(err); }
    const main = $('.main');
    if (main) main.scrollTop = 0;
    closeAllModals();
  }

  function navigate(hash) {
    if (!hash.startsWith('#')) hash = '#' + hash;
    window.location.hash = hash;
  }

  /* ================================================================
     ATAJOS / BUSQUEDA / NAV
  ================================================================ */

  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const search = $('.topbar-search input');
        if (search) search.focus();
        return;
      }
      if (e.key === 'Escape') {
        closeAllModals();
        closeSidebar();
        return;
      }
      const navMap = { '1': 'inicio', '2': 'roadmap', '3': 'recursos', '4': 'horario',
        '5': 'mesa', '6': 'chat', '7': 'sistema', '8': 'config', '9': 'cola' };
      if (navMap[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          navigate(navMap[e.key]);
        }
      }
    });
  }

  function setupNavClicks() {
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = item.dataset.view;
        if (viewName) navigate(viewName);
      });
    });
    const menuToggle = $('.menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
  }

  /* ================================================================
     INIT
  ================================================================ */

  function init() {
    console.log('[App] Inicializando Bitacora v2...');

    const savedTheme = localStorage.getItem('bitacora_theme') || 'dark';
    document.documentElement.dataset.theme = savedTheme;
    const savedAccent = localStorage.getItem('bitacora_accent');
    if (savedAccent) {
      document.documentElement.style.setProperty('--green', savedAccent);
      document.documentElement.style.setProperty('--accent-green', savedAccent);
    }

    if (typeof DB !== 'undefined' && DB.init) DB.init();

    state.currentPhase = getCurrentPhase();
    state.currentTopic = getCurrentTopic();

    // Inicializar modulos
    const modules = [Roadmap, Resources, AIChat, LinkChecker, Discover,
      Queue, Health, Projects, Config, ImportRoadmap, GenerateRoadmap,
      Labs, Tutorials, Messages, Notes, Profile];
    modules.forEach(mod => {
      if (mod && mod.init) {
        try { mod.init(); } catch (e) { console.warn('[App] Error init module:', e); }
      }
    });

    setupNavClicks();
    setupKeyboard();
    window.addEventListener('hashchange', router);

    // Router inicial
    if (window.location.hash) {
      router();
    } else {
      window.location.hash = '#inicio';
    }

    console.log('[App] Bitacora v2 lista.');
  }

  return {
    init, navigate, updateProgress, updateSidebar,
    toggleSidebar, closeSidebar, getCurrentPhase, getCurrentTopic,
    formatDate, relativeTime, escapeHtml, debounce
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
