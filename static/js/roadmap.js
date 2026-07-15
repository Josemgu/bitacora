const Roadmap = (() => {
  'use strict';

  function init() {
    render();
    bindEvents();
  }

  function render() {
    const phases = DB.getAll('phases').sort((a, b) => a.index - b.index);
    const topics = DB.getAll('topics');
    const subtopics = DB.getAll('subtopics');
    renderStrip(phases);
    renderSpine(phases, topics, subtopics);
    App.updateProgress();
  }

  function renderStrip(phases) {
    const strip = document.querySelector('.phase-strip');
    if (!strip) return;
    strip.innerHTML = phases.map(p => {
      const phaseTopics = DB.query('topics', t => t.phase_id === p.id);
      const done = phaseTopics.filter(t => t.status === 'done').length;
      const pct = phaseTopics.length ? Math.round((done / phaseTopics.length) * 100) : 0;
      return `
        <div class="strip-item">
          <span style="color:${p.accent}">F${p.index}</span>
          <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${p.accent}"></div></div>
        </div>`;
    }).join('');
  }

  function renderSpine(phases, topics, subtopics) {
    const container = document.querySelector('.spine-nodes');
    if (!container) return;
    const allTopics = DB.getAll('topics');
    const doneTopics = allTopics.filter(t => t.status === 'done').length;
    const pct = allTopics.length ? Math.round((doneTopics / allTopics.length) * 100) : 0;
    const fill = document.querySelector('.spine-fill');
    if (fill) fill.style.height = pct + '%';
    container.innerHTML = phases.map(p => {
      const phaseTopics = topics.filter(t => t.phase_id === p.id).sort((a, b) => a.order - b.order);
      const isDone = p.status === 'done';
      const isCurrent = p.status === 'current';
      return `
        <div class="node${isDone ? ' state-done' : ''}${isCurrent ? ' state-current' : ''}">
          <div class="node-dot">${isCurrent ? '<div class="pulse"></div>' : ''}</div>
          <div class="node-card" style="--accent:${p.accent}">
            <div class="node-head">
              <span class="node-idx" style="color:${p.accent}">FASE ${p.index}</span>
              <span class="node-when">${p.starts_on || ''} ${p.ends_on ? '→ ' + p.ends_on : ''}</span>
            </div>
            <h3>${p.title}</h3>
            <p>${p.description || ''}</p>
            <ul class="topic-list">
              ${phaseTopics.map(t => {
                const st = subtopics.filter(s => s.topic_id === t.id).sort((a, b) => a.order - b.order);
                const stDone = st.filter(s => s.done).length;
                return `
                <li class="topic${t.status === 'done' ? ' done' : ''}${t.status === 'current' ? ' current' : ''}" data-topic-id="${t.id}">
                  ${t.title}
                  ${st.length > 0 ? `<span style="font-size:10px;color:var(--muted)">(${stDone}/${st.length})</span>` : ''}
                </li>`;
              }).join('')}
            </ul>
            ${renderProjects(p.id)}
          </div>
        </div>`;
    }).join('');
    bindTopicEvents();
  }

  function renderProjects(phaseId) {
    const projects = DB.query('projects', p => p.phase_id === phaseId);
    if (!projects.length) return '';
    return `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <strong style="font-size:11px;color:var(--muted)">PROYECTOS</strong>
        ${projects.map(p => {
          const reqs = DB.query('project_requirements', r => r.project_id === p.id);
          const done = reqs.filter(r => r.done).length;
          return `<div style="margin-top:6px;font-size:12px">
            <span class="tag tag-repo">${p.repo_name}</span>
            <span style="color:var(--muted)">${done}/${reqs.length}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  function bindTopicEvents() {
    document.querySelectorAll('.topic[data-topic-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const topicId = parseInt(e.currentTarget.dataset.topicId);
        toggleTopic(topicId);
      });
    });
  }

  function toggleTopic(topicId) {
    const topic = DB.getById('topics', topicId);
    if (!topic) return;
    const cycle = { todo: 'current', current: 'done', done: 'todo' };
    const newStatus = cycle[topic.status] || 'todo';
    if (newStatus === 'current') {
      const allTopics = DB.getAll('topics');
      allTopics.forEach(t => {
        if (t.status === 'current' && t.id !== topicId) {
          DB.update('topics', t.id, { status: 'todo' });
        }
      });
    }
    DB.update('topics', topicId, { status: newStatus });
    render();
  }

  function bindEvents() {}

  return { init, render, toggleTopic };
})();
