const Roadmap = (() => {
  'use strict';

  async function init() {
    await render();
    bindEvents();
  }

  async function render() {
    try {
      const [phases, topics, subtopics] = await Promise.all([
        API.getPhases(),
        API.getTopics(),
        API.getSubtopics()
      ]);
      
      const sortedPhases = phases.sort((a, b) => a.index - b.index);
      renderStrip(sortedPhases, topics);
      renderSpine(sortedPhases, topics, subtopics);
      App.updateProgress();
    } catch (err) {
      console.error('[Roadmap] Error rendering:', err);
    }
  }

  function renderStrip(phases, topics) {
    const strip = document.querySelector('.phase-strip');
    if (!strip) return;
    strip.innerHTML = phases.map(p => {
      const phaseTopics = topics.filter(t => t.phase_id === p.id);
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
    const allTopics = topics;
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

  async function renderProjects(phaseId) {
    try {
      const projects = await API.getProjects({ phase_id: phaseId });
      if (!projects.length) return '';
      const projectHtml = await Promise.all(projects.map(async p => {
        const reqs = await API.getProjectRequirements({ project_id: p.id });
        const done = reqs.filter(r => r.done).length;
        return `<div style="margin-top:6px;font-size:12px">
          <span class="tag tag-repo">${p.repo_name}</span>
          <span style="color:var(--muted)">${done}/${reqs.length}</span>
        </div>`;
      }));
      return `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <strong style="font-size:11px;color:var(--muted)">PROYECTOS</strong>
          ${projectHtml.join('')}
        </div>`;
    } catch (err) {
      console.error('[Roadmap] Error rendering projects:', err);
      return '';
    }
  }

  function bindTopicEvents() {
    document.querySelectorAll('.topic[data-topic-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const topicId = parseInt(e.currentTarget.dataset.topicId);
        toggleTopic(topicId);
      });
    });
  }

  async function toggleTopic(topicId) {
    try {
      const topic = await API.getTopicById(topicId);
      if (!topic) return;
      const cycle = { todo: 'current', current: 'done', done: 'todo' };
      const newStatus = cycle[topic.status] || 'todo';
      if (newStatus === 'current') {
        const allTopics = await API.getTopics();
        await Promise.all(allTopics
          .filter(t => t.status === 'current' && t.id !== topicId)
          .map(t => API.updateTopic(t.id, { status: 'todo' }))
        );
      }
      await API.updateTopic(topicId, { status: newStatus });
      await render();
    } catch (err) {
      console.error('[Roadmap] Error toggling topic:', err);
    }
  }

  function bindEvents() {}

  return { init, render, toggleTopic };
})();
