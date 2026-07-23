const Roadmap = (() => {
  'use strict';

  let _subtopics = [];

  async function init() {
    await render();
    bindEvents();
  }

  async function render() {
    try {
      const [phases, topics, subtopics, projects, checklists] = await Promise.all([
        API.getPhases(),
        API.getTopics(),
        API.getSubtopics(),
        API.getProjects().catch(() => []),
        Promise.resolve(null)
      ]);

      // Pre-cargar checklists de todos los proyectos (evita async en templates)
      const reqsByProject = {};
      await Promise.all((projects || []).map(async p => {
        reqsByProject[p.id] = await API.getProjectRequirements(p.id).catch(() => []);
      }));

      _subtopics = subtopics || [];
      const sortedPhases = phases.sort((a, b) => a.index - b.index);
      renderStrip(sortedPhases, topics);
      renderSpine(sortedPhases, topics, subtopics, projects || [], reqsByProject);
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

  function renderSpine(phases, topics, subtopics, projects, reqsByProject) {
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
                <li class="topic${t.status === 'done' ? ' done' : ''}${t.status === 'current' ? ' current' : ''}">
                  <span class="topic-label" data-topic-id="${t.id}" style="cursor:pointer">${t.title}</span>
                  ${st.length > 0 ? `<span class="st-expand" data-expand-topic="${t.id}" style="font-size:10px;color:var(--muted);cursor:pointer;user-select:none"> (${stDone}/${st.length}) ▾</span>` : ''}
                  <div class="subtopic-container" id="st-container-${t.id}" style="display:none"></div>
                </li>`;
              }).join('')}
            </ul>
            ${renderProjects(p.id, projects, reqsByProject)}
          </div>
        </div>`;
    }).join('');
    bindTopicEvents();
    bindProjectButtons();
  }

  function renderProjects(phaseId, projects, reqsByProject) {
    const phaseProjects = (projects || []).filter(p => p.phase_id === phaseId);
    const projectHtml = phaseProjects.map(p => {
      const reqs = (reqsByProject && reqsByProject[p.id]) || [];
      const done = reqs.filter(r => r.done).length;
      return `<div style="margin-top:6px;font-size:12px">
        <span class="tag tag-repo">${p.repo_name}</span>
        <span style="color:var(--muted)">${done}/${reqs.length}</span>
      </div>`;
    }).join('');
    return `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <strong style="font-size:11px;color:var(--muted)">PROYECTOS</strong>
        ${projectHtml || '<span style="font-size:11px;color:var(--muted)"> — ninguno</span>'}
        <button class="btn-gen-project" data-phase-id="${phaseId}"
          style="display:block;margin-top:6px;font-size:11px;padding:3px 8px;cursor:pointer;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--muted)">
          ✨ Generar proyecto con IA
        </button>
      </div>`;
  }

  function bindProjectButtons() {
    document.querySelectorAll('.btn-gen-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const phaseId = parseInt(btn.dataset.phaseId);
        btn.textContent = '⏳ Generando...';
        btn.disabled = true;
        try {
          await API.generateProject(phaseId);
          await render();
        } catch (err) {
          btn.textContent = '⚠ ' + (err.message || 'Error');
          btn.disabled = false;
        }
      });
    });
  }

  function bindTopicEvents() {
    // Click en el título del tema → ciclo de estado (todo→current→done)
    document.querySelectorAll('.topic-label[data-topic-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicId = parseInt(el.dataset.topicId);
        toggleTopic(topicId);
      });
    });
    // Click en el contador (x/y) → expandir subtemas con checkboxes
    document.querySelectorAll('.st-expand[data-expand-topic]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const topicId = parseInt(el.dataset.expandTopic);
        const container = document.getElementById('st-container-' + topicId);
        if (!container) return;
        const visible = container.style.display !== 'none';
        if (visible) {
          container.style.display = 'none';
        } else {
          if (typeof Subtopics !== 'undefined' && Subtopics.renderForTopic) {
            Subtopics.renderForTopic(topicId, container, _subtopics);
          }
          container.style.display = '';
        }
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
