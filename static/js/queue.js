const Queue = (() => {
  'use strict';

  let _pendingCount = 0;

  function init() {
    render();
  }

  async function render() {
    const container = document.querySelector('.queue-container');
    let items = [];
    try {
      const all = await API.getResourceQueue();
      items = (all || []).filter(q => q.status === 'pending' || q.status === 'QueueStatus.pending');
    } catch (err) {
      console.error('[Queue] Error cargando cola:', err);
    }
    _pendingCount = items.length;
    renderBadge();

    if (!container) return;
    if (!items.length) {
      container.innerHTML = `
        <div class="empty" style="padding:40px;text-align:center">
          <svg class="ico empty-ico"><use href="#i-info"></use></svg>
          <p>No hay recursos esperando revision.</p>
          <span class="empty-hint">Usa "Descubrir recursos" para buscar en internet.</span>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:13px;color:var(--muted)">${items.length} pendiente(s)</span>
      </div>
      <div class="res-grid">${items.map(item => renderItem(item)).join('')}</div>
    `;
    bindEvents();
  }

  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderItem(item) {
    return `
      <div class="res-card" data-id="${item.id}">
        <div class="res-top">
          <div class="res-logo"><svg class="ico"><use href="#i-ia"></use></svg></div>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${_esc(item.title)}</strong>
            <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">${_esc(item.description || '')}</p>
            <p style="margin:4px 0 0;font-size:11px;color:var(--green)">${_esc(item.rationale || '')}</p>
            <a href="${_esc(item.url)}" target="_blank" rel="noopener noreferrer"
               style="font-size:11px;color:var(--muted);word-break:break-all">${_esc(item.url)}</a>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="tag tag-blue">${_esc(item.category_slug || 'recurso')}</span>
          <span class="tag">${_esc(item.found_by || 'IA')}</span>
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="btn btn-primary btn-xs" data-action="approve" data-id="${item.id}">Aprobar</button>
            <button class="btn btn-ghost btn-xs" data-action="reject" data-id="${item.id}">Rechazar</button>
          </div>
        </div>
      </div>`;
  }

  function bindEvents() {
    document.querySelectorAll('[data-action="approve"]').forEach(btn => {
      btn.addEventListener('click', () => approve(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('[data-action="reject"]').forEach(btn => {
      btn.addEventListener('click', () => reject(parseInt(btn.dataset.id)));
    });
  }

  async function approve(id) {
    try {
      await API.approveResourceQueueItem(id);
      await render();
      if (typeof Resources !== 'undefined' && Resources.render) {
        const resources = await API.getResources().catch(() => null);
        if (resources) Resources.render(resources);
      }
    } catch (err) {
      console.error('[Queue] Error aprobando:', err);
      alert('No se pudo aprobar: ' + (err.message || 'error'));
    }
  }

  async function reject(id) {
    try {
      await API.rejectResourceQueueItem(id);
      await render();
    } catch (err) {
      console.error('[Queue] Error rechazando:', err);
    }
  }

  function renderBadge() {
    const badge = document.getElementById('queue-badge');
    if (!badge) return;
    badge.textContent = _pendingCount;
    badge.style.display = _pendingCount > 0 ? '' : 'none';
  }

  return { init, render, approve, reject, renderBadge };
})();
