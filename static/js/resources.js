/**
 * resources.js — F2: Recursos con CRUD, filtros en tiempo real y búsqueda con debounce.
 * Namespace: Resources
 * Dependencias: API (js/api.js), SVG icons (#i-youtube, #i-github, #i-recursos, #i-extlink)
 */
const Resources = (() => {
  'use strict';

  /* ---------- Estado ---------- */
  const state = {
    category: 'all',
    phase: 'all',
    search: '',
    debounceTimer: null,
    resources: []
  };

  const CATEGORIES = ['youtube', 'blog', 'docs', 'curso', 'github', 'lab', 'ingles'];
  const PHASES = ['0', '1', '2', '3', '4', '5', '6', '7'];

  /* ---------- Cache DOM ---------- */
  let $container = null;
  let $filterBar = null;
  let $searchInput = null;
  let $grid = null;

  /* ---------- Utilidades ---------- */
  const esc = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  };

  const extractHostname = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url.split('/')[0] || '';
    }
  };

  const nowISO = () => new Date().toISOString();

  /* ---------- Favicon ---------- */
  const getFavicon = (url) => {
    const host = extractHostname(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  };

  const getCategoryIcon = (category) => {
    const map = {
      youtube: '#i-youtube',
      github: '#i-github'
    };
    return map[category] || '#i-recursos';
  };

  const getCategoryLabel = (cat) => {
    const labels = {
      youtube: 'YouTube',
      blog: 'Blog',
      docs: 'Docs',
      curso: 'Curso',
      github: 'GitHub',
      lab: 'Lab',
      ingles: 'Inglés'
    };
    return labels[cat] || esc(cat);
  };

  const getCategoryTagClass = (cat) => {
    const map = {
      youtube: 'tag tag-green',
      blog: 'tag tag-blue',
      docs: 'tag tag-blue',
      curso: 'tag tag-green',
      github: 'tag',
      lab: 'tag',
      ingles: 'tag tag-blue'
    };
    return map[cat] || 'tag';
  };

  const getLinkStatusDot = (status) => {
    const map = {
      ok: 'dot-green',
      redirect: 'dot-yellow',
      broken: 'dot-red',
      unknown: 'dot-gray'
    };
    return map[status] || 'dot-gray';
  };

  const getLinkStatusLabel = (status) => {
    const map = {
      ok: 'OK',
      redirect: 'Redirect',
      broken: 'Roto',
      unknown: 'Sin verificar'
    };
    return map[status] || 'Sin verificar';
  };

  /* ---------- Selección de elementos del DOM ---------- */
  const ensureDOM = () => {
    $container = document.getElementById('recursos');
    if (!$container) return false;
    $filterBar = $container.querySelector('.filter-bar');
    $searchInput = $container.querySelector('.search-field');
    $grid = $container.querySelector('.res-grid');
    return true;
  };

  /* ==================== INIT ==================== */
  const init = async () => {
    if (!ensureDOM()) return;
    await loadResources();
    bindEvents();
    render();
  };

  const loadResources = async () => {
    try {
      state.resources = await API.getResources();
    } catch (err) {
      console.error('[Resources] Error loading resources:', err);
      state.resources = [];
    }
  };

  /* ---------- Eventos ---------- */
  const bindEvents = () => {
    /* Chips de categoría */
    if ($filterBar) {
      $filterBar.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip[data-category]');
        if (chip) {
          state.category = chip.dataset.category;
          renderFilters();
          render();
          return;
        }
        const phaseChip = e.target.closest('.chip[data-phase]');
        if (phaseChip) {
          state.phase = phaseChip.dataset.phase;
          renderFilters();
          render();
        }
      });
    }

    /* Búsqueda con debounce */
    if ($searchInput) {
      $searchInput.addEventListener('input', (e) => {
        const raw = e.target.value;
        state.search = raw.trim().toLowerCase();
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => render(), 200);
      });
    }

    /* Botón agregar recurso */
    const $addBtn = $container.querySelector('.btn-add-resource');
    if ($addBtn) {
      $addBtn.addEventListener('click', showAddModal);
    }

    /* Delegación: archivar recurso */
    if ($grid) {
      $grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="archive"]');
        if (btn) {
          const id = parseInt(btn.dataset.id, 10);
          if (!Number.isNaN(id)) archiveResource(id);
        }
      });
    }
  };

  /* ==================== RENDER ==================== */
  const render = () => {
    const items = filterData();
    renderFilters();
    renderGrid(items);
  };

  /* ---------- Render Filtros ---------- */
  const renderFilters = () => {
    if (!$filterBar) return;

    const catHtml = [
      { key: 'all', label: 'Todos' },
      ...CATEGORIES.map(c => ({ key: c, label: getCategoryLabel(c) }))
    ].map(item => {
      const on = state.category === item.key ? ' is-on' : '';
      return `<button class="chip${on}" data-category="${item.key}">${esc(item.label)}</button>`;
    }).join('');

    const phaseHtml = [
      { key: 'all', label: 'Todas' },
      ...PHASES.map(p => ({ key: p, label: `F${p}` }))
    ].map(item => {
      const on = state.phase === item.key ? ' is-on' : '';
      return `<button class="chip chip-sm${on}" data-phase="${item.key}">${esc(item.label)}</button>`;
    }).join('');

    $filterBar.innerHTML = `
      <div class="filter-group filter-categories">
        ${catHtml}
      </div>
      <div class="filter-group filter-phases">
        ${phaseHtml}
      </div>
    `;
  };

  /* ---------- Filtrar datos ---------- */
  const filterData = () => {
    const all = state.resources;
    return all.filter(item => {
      /* No archivados */
      if (item.status === 'archived') return false;

      /* Filtro categoría */
      if (state.category !== 'all' && item.category !== state.category) return false;

      /* Filtro fase */
      if (state.phase !== 'all' && String(item.phase) !== state.phase) return false;

      /* Búsqueda de texto */
      if (state.search) {
        const hay = `${item.title || ''} ${item.description || ''}`.toLowerCase();
        if (!hay.includes(state.search)) return false;
      }

      return true;
    });
  };

  /* ---------- Render Grid ---------- */
  const renderGrid = (items) => {
    if (!$grid) return;

    /* Estado vacío */
    if (!items || items.length === 0) {
      $grid.innerHTML = `
        <div class="empty">
          <div class="empty-ico">
            <svg width="48" height="48"><use href="#i-recursos"/></svg>
          </div>
          <p>No se encontraron recursos.</p>
          <p class="empty-hint">Prueba ajustando los filtros o agrega un nuevo recurso.</p>
        </div>
      `;
      return;
    }

    $grid.innerHTML = items.map(item => {
      const favicon = getFavicon(item.url || '');
      const catIcon = getCategoryIcon(item.category);
      const catLabel = getCategoryLabel(item.category);
      const catTagClass = getCategoryTagClass(item.category);
      const phaseLabel = item.phase != null ? `F${item.phase}` : '';
      const dotClass = getLinkStatusDot(item.link_status);
      const statusLabel = getLinkStatusLabel(item.link_status);
      const title = esc(item.title || 'Sin título');
      const description = esc(item.description || '');
      const url = esc(item.url || '');
      const category = esc(item.category || '');

      return `
        <article class="res-card" data-id="${item.id}">
          <div class="res-card-header">
            <div class="res-logo">
              <img src="${favicon}" alt="" loading="lazy"
                   onerror="this.style.display='none';this.parentNode.innerHTML='<svg width=24 height=24><use href=\\'${catIcon}\\'/></svg>'">
            </div>
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="res-title-link">
              <h3 class="res-title">${title}</h3>
              <svg class="res-ext" width="14" height="14"><use href="#i-extlink"/></svg>
            </a>
          </div>
         <p class="res-desc">${description}</p>
          <div class="res-meta">
            <span class="${catTagClass}">${catLabel}</span>
            ${phaseLabel ? `<span class="tag">${phaseLabel}</span>` : ''}
            <span class="${dotClass}" title="Link: ${statusLabel}"></span>
          </div>
          <div class="res-actions">
            <button class="btn btn-ghost btn-sm" data-action="archive" data-id="${item.id}">Archivar</button>
          </div>
        </article>
      `;
    }).join('');
  };

  /* ==================== CRUD ==================== */

  /* ---------- Modal: Agregar recurso ---------- */
  const showAddModal = () => {
    const modalId = 'modal-add-resource';
    let $modal = document.getElementById(modalId);

    if ($modal) {
      $modal.classList.remove('hidden');
      return;
    }

    /* Crear modal */
    $modal = document.createElement('div');
    $modal.id = modalId;
    $modal.className = 'modal-overlay';
    $modal.innerHTML = `
      <div class="modal">
        <header class="modal-header">
          <h3>Agregar recurso</h3>
          <button class="btn btn-ghost btn-sm modal-close" aria-label="Cerrar">&times;</button>
        </header>
        <form class="modal-body form-resource" id="form-add-resource">
          <div class="form-group">
            <label for="res-url">URL *</label>
            <input type="url" id="res-url" name="url" required placeholder="https://..." autocomplete="off">
            <span class="form-hint loading-hint hidden">Detectando título...</span>
          </div>
          <div class="form-group">
            <label for="res-title">Título</label>
            <input type="text" id="res-title" name="title" placeholder="Título del recurso">
          </div>
          <div class="form-group">
            <label for="res-desc">Descripción</label>
            <textarea id="res-desc" name="description" rows="2" placeholder="Breve descripción..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="res-category">Categoría</label>
              <select id="res-category" name="category">
                ${CATEGORIES.map(c => `<option value="${c}">${getCategoryLabel(c)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="res-phase">Fase</label>
              <select id="res-phase" name="phase">
                <option value="">—</option>
                ${PHASES.map(p => `<option value="${p}">F${p}</option>`).join('')}
              </select>
            </div>
          </div>
        </form>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost modal-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary" form="form-add-resource">Guardar</button>
        </footer>
      </div>
    `;

    document.body.appendChild($modal);

    /* Eventos del modal */
    const closeModal = () => $modal.classList.add('hidden');

    $modal.querySelector('.modal-close').addEventListener('click', closeModal);
    $modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    $modal.addEventListener('click', (e) => {
      if (e.target === $modal) closeModal();
    });

    /* Pegar URL → detectar título (simulado) */
    const $urlInput = $modal.querySelector('#res-url');
    const $titleInput = $modal.querySelector('#res-title');
    const $hint = $modal.querySelector('.loading-hint');

    $urlInput.addEventListener('paste', (e) => {
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      if (!pasted) return;
      try {
        const u = new URL(pasted);
        $hint.classList.remove('hidden');
        /* Simulación: después de 800ms extrae el hostname como título sugerido */
        setTimeout(() => {
          if (!$titleInput.value) {
            $titleInput.value = u.hostname.replace(/^www\./, '');
          }
          $hint.classList.add('hidden');
        }, 800);
      } catch { /* ignore invalid URL */ }
    });

    /* Submit del formulario */
    const $form = $modal.querySelector('#form-add-resource');
    $form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData($form);
      const urlVal = fd.get('url')?.trim();
      if (!urlVal) return;

      /* Validación básica de URL */
      let validUrl;
      try {
        validUrl = new URL(urlVal).href;
      } catch {
        alert('La URL no es válida');
        return;
      }

      const newResource = {
        title: fd.get('title')?.trim() || validUrl,
        url: validUrl,
        description: fd.get('description')?.trim() || '',
        category: fd.get('category') || 'blog',
        phase: fd.get('phase') != null && fd.get('phase') !== '' ? parseInt(fd.get('phase'), 10) : null,
        origin: 'manual',
        status: 'active',
        link_status: 'unknown',
        created_at: nowISO(),
        updated_at: nowISO()
      };

      try {
        const inserted = await API.createResource(newResource);
        if (inserted) {
          closeModal();
          $form.reset();
          await loadResources();
          render();
        } else {
          alert('Error al guardar el recurso.');
        }
      } catch (err) {
        console.error('[Resources] Error creating resource:', err);
        alert('Error al guardar el recurso.');
      }
    });

    /* Enfocar URL */
    setTimeout(() => $urlInput.focus(), 50);
  };

  /* ---------- Archivar recurso ---------- */
  const archiveResource = async (id) => {
    if (!confirm('¿Archivar este recurso? Seguirá disponible pero oculto.')) return;
    try {
      const updated = await API.updateResource(id, {
        status: 'archived',
        updated_at: nowISO()
      });
      if (updated) {
        await loadResources();
        render();
      }
    } catch (err) {
      console.error('[Resources] Error archiving resource:', err);
    }
  };

  /* ==================== API Pública ==================== */
  return {
    state,
    init,
    render,
    renderFilters,
    filterData,
    renderGrid,
    showAddModal,
    archiveResource,
    getFavicon,
    getCategoryIcon
  };
})();