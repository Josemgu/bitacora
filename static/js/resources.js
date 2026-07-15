const Resources = (() => {
  'use strict';

  var state = { category: 'all', phase: 'all', search: '', debounceTimer: null };

  function init() {
    render();
    bindEvents();
  }

  function render() {
    renderFilters();
    var items = filterData();
    renderGrid(items);
  }

  function renderFilters() {
    var chips = document.getElementById('resource-cat-chips');
    if (!chips) return;
  }

  function filterData() {
    var items = DB.getAll('resources');
    if (state.category !== 'all') {
      items = items.filter(function(r) { return r.category === state.category; });
    }
    if (state.search) {
      var q = state.search.toLowerCase();
      items = items.filter(function(r) {
        return (r.title && r.title.toLowerCase().includes(q)) ||
               (r.description && r.description.toLowerCase().includes(q));
      });
    }
    return items;
  }

  function renderGrid(items) {
    var grid = document.getElementById('resources-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<div class="empty"><svg class="ico empty-ico"><use href="#i-info"></use></svg><p>No hay recursos.</p></div>';
      return;
    }
    grid.innerHTML = items.map(function(r) {
      var host = '';
      try { host = new URL(r.url).hostname; } catch(e) { host = ''; }
      var favicon = host ? 'https://www.google.com/s2/favicons?domain=' + host + '&sz=64' : '';
      return `
        <div class="res-card" data-id="${r.id}">
          <div class="res-top">
            <div class="res-logo">${favicon ? '<img src="' + favicon + '" alt="" style="width:28px;height:28px">' : '<svg class="ico"><use href="#i-recursos"></use></svg>'}</div>
            <div style="flex:1;min-width:0">
              <strong style="font-size:13px">${r.title}</strong>
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">${r.description || ''}</p>
            </div>
            <a href="${r.url}" target="_blank" rel="noopener" class="res-ext"><svg class="ico"><use href="#i-externo"></use></svg></a>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
            <span class="tag tag-blue">${r.category || 'recurso'}</span>
            <span class="tag">${r.origin || 'manual'}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--muted)">${host}</span>
          </div>
        </div>`;
    }).join('');
  }

  function bindEvents() {
    var search = document.getElementById('resources-search');
    if (search) {
      search.addEventListener('input', function(e) {
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(function() {
          state.search = e.target.value;
          render();
        }, 200);
      });
    }
  }

  return { init, render, filterData };
})();
