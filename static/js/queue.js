const Queue = (() => {
  'use strict';

  function init() {
    render();
    renderBadge();
  }

  function render() {
    const container = document.querySelector('.queue-container');
    if (!container) return;
    const items = DB.query('resource_queue', q => q.status === 'pending');
    if (!items.length) {
      container.innerHTML = `
        <div class="empty" style="padding:40px;text-align:center">
          <svg class="ico empty-ico"><use href="#i-info"></use></svg>
          <p>No hay recursos esperando revision.</p>
          <span class="empty-hint">La IA agregara recursos aqui para que los revises.</span>
        </div>`;
      return;
    }
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-size:13px;color:var(--muted)">${items.length} pendiente(s)</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" id="queue-bulk-approve">Aprobar seleccionados</button>
          <button class="btn btn-danger btn-sm" id="queue-bulk-reject">Rechazar seleccionados</button>
        </div>
      </div>
      <div class="res-grid">${items.map(item => renderItem(item)).join('')}</div>
    `;
    bindEvents();
  }

  function renderItem(item) {
    return `
      <div class="res-card" data-id="${item.id}">
        <div class="res-top">
          <div class="res-logo"><svg class="ico"><use href="#i-ia"></use></svg></div>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${item.title}</strong>
            <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">${item.description || ''}</p>
            <p style="margin:4px 0 0;font-size:11px;color:var(--green)">${item.rationale || ''}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="tag tag-blue">${item.category || 'recurso'}</span>
          <span class="tag">Confianza: ${Math.round((item.confidence || 0.7) * 100)}%</span>
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

  function approve(id) {
    const item = DB.getById('resource_queue', id);
    if (!item) return;
    DB.insert('resources', {
      title: item.title,
      url: item.url,
      description: item.description,
      category: item.category || 'recursos',
      origin: 'ai',
      status: 'active',
      link_status: 'unknown'
    });
    DB.update('resource_queue', id, { status: 'approved', reviewed_at: new Date().toISOString() });
    render();
    renderBadge();
    if (typeof Resources !== 'undefined' && Resources.render) Resources.render();
  }

  function reject(id) {
    DB.update('resource_queue', id, { status: 'rejected', reviewed_at: new Date().toISOString() });
    render();
    renderBadge();
  }

  function renderBadge() {
    const badge = document.getElementById('queue-badge');
    if (!badge) return;
    const count = DB.query('resource_queue', q => q.status === 'pending').length;
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }

  return { init, render, approve, reject, renderBadge };
})();
