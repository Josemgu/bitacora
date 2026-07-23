const Subtopics = (() => {
  'use strict';

  /**
   * Marca/desmarca un subtema. El backend recalcula automáticamente el
   * estado del tema y de la fase (done/current/todo).
   */
  async function toggle(subtopicId) {
    try {
      await API.toggleSubtopic(subtopicId);
      if (typeof Roadmap !== 'undefined' && Roadmap.render) await Roadmap.render();
      if (typeof App !== 'undefined' && App.updateProgress) App.updateProgress();
    } catch (err) {
      console.error('[Subtopics] Error al marcar subtema:', err);
    }
  }

  function renderForTopic(topicId, container, subtopics) {
    const list = (subtopics || []).filter(s => s.topic_id === topicId)
      .sort((a, b) => a.order - b.order);
    if (!list.length) return;

    const html = list.map(st => `
      <label class="subtopic-item" data-id="${st.id}">
        <input type="checkbox" ${st.done ? 'checked' : ''} data-subtopic-id="${st.id}">
        <span class="subtopic-title${st.done ? ' done' : ''}">${st.title}</span>
      </label>
    `).join('');

    container.innerHTML = `<div class="subtopic-list">${html}</div>`;

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        toggle(parseInt(e.target.dataset.subtopicId));
      });
    });
  }

  function injectStyles() {
    if (document.getElementById('subtopic-styles')) return;
    const style = document.createElement('style');
    style.id = 'subtopic-styles';
    style.textContent = `
      .subtopic-list { margin: 8px 0 8px 24px; display: flex; flex-direction: column; gap: 6px; }
      .subtopic-item { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: background .15s; }
      .subtopic-item:hover { background: var(--card); }
      .subtopic-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--green); cursor: pointer; flex-shrink: 0; }
      .subtopic-title { font-size: 13px; color: var(--text-secondary); transition: all .2s; }
      .subtopic-title.done { text-decoration: line-through; opacity: .5; color: var(--muted); }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', injectStyles);

  return { toggle, renderForTopic };
})();
