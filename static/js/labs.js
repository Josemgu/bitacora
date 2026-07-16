/* ═══════════════════════════════════════════
   Labs — AI Learning OS Extension
   Grid de laboratorios practicos con filtros
   ═══════════════════════════════════════════ */

const Labs = (() => {
  'use strict';

  /* ── Seed data ── */
  const LABS_DATA = [
    { id: 1, title: 'Pre-Security Path',          description: 'Fundamentos de ciberseguridad y conceptos basicos.',             platform: 'tryhackme',        url: 'https://tryhackme.com/path/outline/presecurity',        difficulty: 'beginner',     is_free: true,  phase_id: 1 },
    { id: 2, title: 'SOC Level 1',                description: 'Simulacion de operaciones SOC con alertas reales.',              platform: 'tryhackme',        url: 'https://tryhackme.com/path/outline/soclevel1',          difficulty: 'beginner',     is_free: false, phase_id: 5 },
    { id: 3, title: 'Jr Penetration Tester',      description: 'Pentesting basico con maquinas y exploitacion.',                 platform: 'tryhackme',        url: 'https://tryhackme.com/path/outline/jrpenetrationtester', difficulty: 'intermediate', is_free: false, phase_id: 2 },
    { id: 4, title: 'Starting Point',             description: 'Maquinas vulnerables para principiantes en HTB.',                platform: 'hackthebox',       url: 'https://app.hackthebox.com/starting-point',             difficulty: 'beginner',     is_free: true,  phase_id: 2 },
    { id: 5, title: 'SOC Labs',                   description: 'Simulador de SOC con alertas y playbooks.',                      platform: 'letsdefend',       url: 'https://letsdefend.io/',                                 difficulty: 'intermediate', is_free: false, phase_id: 5 },
    { id: 6, title: 'Cloud Practitioner',         description: 'Fundamentos de AWS cloud y servicios basicos.',                  platform: 'aws_skill_builder', url: 'https://skillbuilder.aws/',                             difficulty: 'beginner',     is_free: true,  phase_id: 3 },
    { id: 7, title: 'Azure Fundamentals',         description: 'Preparacion para el examen AZ-900.',                              platform: 'azure_learn',      url: 'https://learn.microsoft.com/azure/',                     difficulty: 'beginner',     is_free: true,  phase_id: 3 },
    { id: 8, title: 'Cloud Skills Boost',         description: 'Labs practicos de Google Cloud Platform.',                       platform: 'google_cloud_skills', url: 'https://www.cloudskillsboost.google/',                difficulty: 'beginner',     is_free: false, phase_id: 3 },
    { id: 9, title: 'Kubernetes Labs',            description: 'Practica Kubernetes directamente en el navegador.',              platform: 'kodekloud',        url: 'https://kodekloud.com/',                                 difficulty: 'intermediate', is_free: false, phase_id: 4 },
    { id: 10, title: 'Web Security Academy',      description: 'Vulnerabilidades web practicas por PortSwigger.',                platform: 'portswigger',      url: 'https://portswigger.net/web-security',                   difficulty: 'intermediate', is_free: true,  phase_id: 2 },
    { id: 11, title: 'Bandit Wargame',            description: 'Aprende Linux y seguridad jugando niveles tipo CTF.',            platform: 'overthewire',      url: 'https://overthewire.org/wargames/bandit/',               difficulty: 'beginner',     is_free: true,  phase_id: 1 },
    { id: 12, title: 'PicoCTF',                   description: 'CTF educativo ideal para principiantes en ciberseguridad.',      platform: 'picoctf',          url: 'https://picoctf.org/',                                   difficulty: 'beginner',     is_free: true,  phase_id: 0 },
    { id: 13, title: 'Active Directory Basics',   description: 'Enumera y explota entornos Windows AD.',                         platform: 'tryhackme',        url: 'https://tryhackme.com/module/active-directory-basics',   difficulty: 'intermediate', is_free: false, phase_id: 2 },
    { id: 14, title: 'Splunk Basics',             description: 'Introduccion a SIEM con Splunk y busquedas SPL.',                platform: 'letsdefend',       url: 'https://letsdefend.io/training',                         difficulty: 'beginner',     is_free: true,  phase_id: 5 },
    { id: 15, title: 'Docker Labs',               description: 'Contenedores y orquestacion con ejercicios practicos.',          platform: 'kodekloud',        url: 'https://kodekloud.com/courses/docker-for-the-absolute-beginner/', difficulty: 'beginner', is_free: false, phase_id: 4 }
  ];

  /* ── Platform meta ── */
  const PLATFORM_META = {
    tryhackme:           { label: 'TryHackMe',         color: 'green'  },
    hackthebox:          { label: 'Hack The Box',      color: 'red'    },
    letsdefend:          { label: 'LetsDefend',        color: 'blue'   },
    aws_skill_builder:   { label: 'AWS Skill Builder', color: 'yellow' },
    azure_learn:         { label: 'Azure Learn',       color: 'blue'   },
    google_cloud_skills: { label: 'Google Cloud',      color: 'green'  },
    kodekloud:           { label: 'KodeKloud',         color: 'cyan'   },
    portswigger:         { label: 'PortSwigger',       color: 'purple' },
    overthewire:         { label: 'OverTheWire',       color: 'gray'   },
    picoctf:             { label: 'PicoCTF',           color: 'yellow' }
  };

  const DIFFICULTY_META = {
    beginner:     { label: 'Principiante',  dot: 'dot-green'  },
    intermediate: { label: 'Intermedio',    dot: 'dot-yellow' },
    advanced:     { label: 'Avanzado',      dot: 'dot-red'    }
  };

  /* ── State ── */
  const state = {
    labs:        [...LABS_DATA],
    filterText:  '',
    platform:    'all'
  };

  /* ── DOM cache ── */
  let $search   = null;
  let $chips    = null;
  let $grid     = null;
  let $view     = null;

  /* ═══════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════ */

  function getPlatformColor(platform) {
    return PLATFORM_META[platform]?.color || 'gray';
  }

  function getPlatformLabel(platform) {
    return PLATFORM_META[platform]?.label || platform;
  }

  function getDifficultyMeta(difficulty) {
    return DIFFICULTY_META[difficulty] || { label: difficulty, dot: 'dot-gray' };
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ═══════════════════════════════════════════
     Filtering
     ═══════════════════════════════════════════ */

  function filterLabs() {
    const text   = state.filterText.toLowerCase().trim();
    const plat   = state.platform;

    return state.labs.filter(lab => {
      const matchesText = !text ||
        lab.title.toLowerCase().includes(text) ||
        lab.description.toLowerCase().includes(text) ||
        getPlatformLabel(lab.platform).toLowerCase().includes(text);

      const matchesPlatform = plat === 'all' || lab.platform === plat;

      return matchesText && matchesPlatform;
    });
  }

  /* ═══════════════════════════════════════════
     Rendering
     ═══════════════════════════════════════════ */

  function renderEmpty() {
    return `
      <div class="empty">
        <div class="empty-ico">
          <svg class="ico"><use href="#i-busqueda"></use></svg>
        </div>
        <p class="empty-hint">No se encontraron laboratorios con los filtros activos.</p>
        <button class="btn btn-sm btn-ghost" id="labs-clear-filters">Limpiar filtros</button>
      </div>
    `;
  }

  function renderGrid(items) {
    if (!$grid) return;

    if (!items || items.length === 0) {
      $grid.innerHTML = renderEmpty();
      bindClearFilters();
      return;
    }

    const html = items.map(lab => {
      const platLabel = escapeHtml(getPlatformLabel(lab.platform));
      const platColor = getPlatformColor(lab.platform);
      const diffMeta  = getDifficultyMeta(lab.difficulty);
      const freeTag   = lab.is_free
        ? '<span class="tag tag-green">Gratis</span>'
        : '<span class="tag">Premium</span>';

      return `
        <div class="res-card" data-id="${lab.id}" data-platform="${escapeHtml(lab.platform)}">
          <div class="res-top">
            <div class="res-logo" style="background:var(--${platColor})">
              <span class="mono" style="color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;">
                ${platLabel.substring(0, 3)}
              </span>
            </div>
            <div class="res-ext">
              <svg class="ico" style="width:14px;height:14px;opacity:.5;"><use href="#i-externo"></use></svg>
            </div>
          </div>
          <h4 style="margin:8px 0 4px;font-size:14px;font-weight:600;color:var(--text);">
            ${escapeHtml(lab.title)}
          </h4>
          <p style="margin:0 0 10px;font-size:12px;color:var(--text-sec);line-height:1.4;">
            ${escapeHtml(lab.description)}
          </p>
          <div class="chip-row" style="gap:6px;">
            <span class="chip chip-sm" style="background:var(--${platColor})22;color:var(--${platColor});border-color:var(--${platColor})44;">
              ${platLabel}
            </span>
            <span class="chip chip-sm">
              <span class="dot ${diffMeta.dot}"></span>
              ${escapeHtml(diffMeta.label)}
            </span>
            ${freeTag}
          </div>
          <a href="${escapeHtml(lab.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-primary" style="margin-top:10px;width:100%;text-align:center;"
             onclick="Labs.openLab('${escapeHtml(lab.url)}');return false;">
            <svg class="ico" style="width:12px;height:12px;margin-right:4px;"><use href="#i-externo"></use></svg>
            Abrir Lab
          </a>
        </div>
      `;
    }).join('');

    $grid.innerHTML = `<div class="res-grid">${html}</div>`;
  }

  function renderPlatformChips() {
    if (!$chips) return;

    const platforms = ['all', ...new Set(LABS_DATA.map(l => l.platform))];
    const labels = { all: 'Todas' };

    const html = platforms.map(p => {
      const label = labels[p] || getPlatformLabel(p);
      const isOn  = state.platform === p ? 'is-on' : '';
      return `<button class="chip ${isOn}" data-platform="${p}">${escapeHtml(label)}</button>`;
    }).join('');

    $chips.innerHTML = html;
  }

  function render() {
    renderPlatformChips();
    const filtered = filterLabs();
    renderGrid(filtered);
  }

  /* ═══════════════════════════════════════════
     Actions
     ═══════════════════════════════════════════ */

  function openLab(url) {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function clearFilters() {
    state.filterText = '';
    state.platform   = 'all';
    if ($search) $search.value = '';
    render();
  }

  /* ═══════════════════════════════════════════
     Event bindings
     ═══════════════════════════════════════════ */

  function bindClearFilters() {
    const $clearBtn = $grid?.querySelector('#labs-clear-filters');
    if ($clearBtn) {
      $clearBtn.addEventListener('click', clearFilters);
    }
  }

  function bindEvents() {
    if (!$search || !$chips) return;

    /* Search */
    $search.addEventListener('input', (e) => {
      state.filterText = e.target.value;
      const filtered = filterLabs();
      renderGrid(filtered);
    });

    /* Platform chips */
    $chips.addEventListener('click', (e) => {
      const $chip = e.target.closest('.chip[data-platform]');
      if (!$chip) return;

      state.platform = $chip.dataset.platform;
      render();
    });
  }

  /* ═══════════════════════════════════════════
     Init
     ═══════════════════════════════════════════ */

  function init() {
    try {
      $view   = document.getElementById('view-labs');
      $search = document.getElementById('labs-search');
      $chips  = document.getElementById('labs-platform-chips');
      $grid   = document.getElementById('labs-grid');

      if (!$grid) {
        console.warn('[Labs] #labs-grid no encontrado. Render omitido.');
        return;
      }

      render();
      bindEvents();
    } catch (err) {
      console.error('[Labs] Error en init:', err);
    }
  }

  /* ── Public API ── */
  return {
    init,
    render,
    filterLabs,
    renderGrid,
    getPlatformColor,
    getPlatformLabel,
    openLab
  };
})();