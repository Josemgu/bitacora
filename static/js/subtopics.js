const Subtopics = (() => {
  'use strict';

  function toggle(subtopicId) {
    const st = DB.getById('subtopics', subtopicId);
    if (!st) return;
    st.done = !st.done;
    st.done_at = st.done ? new Date().toISOString() : null;
    DB.update('subtopics', subtopicId, st);

    const topic = DB.getById('topics', st.topic_id);
    const siblings = DB.query('subtopics', s => s.topic_id === st.topic_id);
    const allDone = siblings.every(s => s.done);
    const someDone = siblings.some(s => s.done);

    let newStatus = 'todo';
    if (allDone) newStatus = 'done';
    else if (someDone) newStatus = 'current';

    if (topic.status !== newStatus) {
      DB.update('topics', topic.id, { status: newStatus });
      const phase = DB.getById('phases', topic.phase_id);
      const phaseTopics = DB.query('topics', t => t.phase_id === phase.id);
      const phaseAllDone = phaseTopics.every(t => t.status === 'done');
      const phaseSomeDone = phaseTopics.some(t => t.status === 'done' || t.status === 'current');
      let phaseStatus = 'todo';
      if (phaseAllDone) phaseStatus = 'done';
      else if (phaseSomeDone) phaseStatus = 'current';
      DB.update('phases', phase.id, { status: phaseStatus });
    }

    Roadmap.render();
    App.updateProgress();
  }

  function renderForTopic(topicId, container) {
    const subtopics = DB.query('subtopics', s => s.topic_id === topicId).sort((a, b) => a.order - b.order);
    if (!subtopics.length) return;

    const html = subtopics.map(st => `
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
