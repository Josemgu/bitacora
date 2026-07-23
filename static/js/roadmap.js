const Roadmap = (() => {
  'use strict';

  let currentPhaseId = null;
  let currentTopicId = null;
  let currentSubtopicId = null;

  async function init() {
    await render();
    bindEvents();
  }

  async function render() {
    try {
      const [phases, topics, subtopics] = await Promise.all([
        RoadmapAPI.getPhases(),
        RoadmapAPI.getTopics(),
        RoadmapAPI.getSubtopics()
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
        <div class="node${isDone ? ' state-done' : ''}${isCurrent ? ' state-current' : ''}" data-phase-id="${p.id}">
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
      const projects = await RoadmapAPI.getProjects(phaseId);
      if (!projects.length) return '';
      const projectHtml = await Promise.all(projects.map(async p => {
        const reqs = await RoadmapAPI.getProjectRequirements(p.id);
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
      const topic = await RoadmapAPI.getTopic(topicId);
      if (!topic) return;
      const cycle = { todo: 'current', current: 'done', done: 'todo' };
      const newStatus = cycle[topic.status] || 'todo';
      if (newStatus === 'current') {
        const allTopics = await RoadmapAPI.getTopics();
        await Promise.all(allTopics
          .filter(t => t.status === 'current' && t.id !== topicId)
          .map(t => RoadmapAPI.updateTopic(t.id, { status: 'todo' }))
        );
      }
      await RoadmapAPI.updateTopic(topicId, { status: newStatus });
      await render();
    } catch (err) {
      console.error('[Roadmap] Error toggling topic:', err);
    }
  }

  // ================================================================
  // BIND EVENTS - Full CRUD, Reordering, Import, AI
  // ================================================================

  function bindEvents() {
    bindPhaseEvents();
    bindTopicEvents();
    bindSubtopicEvents();
    bindProjectEvents();
    bindImportEvents();
    bindAIEvents();
    bindReorderEvents();
  }

  // --- PHASE EVENTS ---
  function bindPhaseEvents() {
    // Add phase button
    const addPhaseBtn = document.getElementById('add-phase-btn');
    if (addPhaseBtn) {
      addPhaseBtn.addEventListener('click', () => openPhaseModal());
    }

    // Phase card actions (edit, delete, reorder)
    document.addEventListener('click', async (e) => {
      const phaseCard = e.target.closest('.node[data-phase-id]');
      if (!phaseCard) return;

      const phaseId = parseInt(phaseCard.dataset.phaseId);

      // Edit phase
      if (e.target.closest('.phase-edit-btn')) {
        e.stopPropagation();
        openPhaseModal(phaseId);
      }

      // Delete phase
      if (e.target.closest('.phase-delete-btn')) {
        e.stopPropagation();
        if (confirm('¿Eliminar esta fase y todos sus temas?')) {
          await RoadmapAPI.deletePhase(phaseId);
          await render();
        }
      }

      // Reorder up/down
      if (e.target.closest('.phase-move-up')) {
        e.stopPropagation();
        await movePhase(phaseId, -1);
      }
      if (e.target.closest('.phase-move-down')) {
        e.stopPropagation();
        await movePhase(phaseId, 1);
      }
    });
  }

  async function openPhaseModal(phaseId = null) {
    const modal = document.getElementById('phase-modal');
    const form = document.getElementById('phase-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('phase-id').value = phaseId || '';

    if (phaseId) {
      const phase = await RoadmapAPI.getPhase(phaseId);
      if (phase) {
        document.getElementById('phase-title').value = phase.title;
        document.getElementById('phase-description').value = phase.description || '';
        document.getElementById('phase-accent').value = phase.accent || '#6366f1';
        document.getElementById('phase-starts-on').value = phase.starts_on || '';
        document.getElementById('phase-ends-on').value = phase.ends_on || '';
        document.getElementById('phase-status').value = phase.status || 'todo';
      }
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        title: document.getElementById('phase-title').value,
        description: document.getElementById('phase-description').value,
        accent: document.getElementById('phase-accent').value,
        starts_on: document.getElementById('phase-starts-on').value || null,
        ends_on: document.getElementById('phase-ends-on').value || null,
        status: document.getElementById('phase-status').value,
      };

      try {
        if (phaseId) {
          await RoadmapAPI.updatePhase(phaseId, data);
        } else {
          await RoadmapAPI.createPhase(data);
        }
        modal.classList.remove('open');
        await render();
      } catch (err) {
        console.error('[Roadmap] Error saving phase:', err);
        alert('Error al guardar la fase');
      }
    };
  }

  async function movePhase(phaseId, direction) {
    const phases = await RoadmapAPI.getPhases();
    const sorted = phases.sort((a, b) => a.index - b.index);
    const idx = sorted.findIndex(p => p.id === phaseId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    // Swap indices
    const orders = sorted.map((p, i) => ({ id: p.id, index: i }));
    [orders[idx], orders[newIdx]] = [orders[newIdx], orders[idx]];

    await RoadmapAPI.reorderPhases(orders);
    await render();
  }

  // --- TOPIC EVENTS ---
  function bindTopicEvents() {
    // Add topic buttons
    document.querySelectorAll('.add-topic-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phaseId = parseInt(e.target.closest('[data-phase-id]')?.dataset.phaseId);
        if (phaseId) openTopicModal(phaseId);
      });
    });

    // Topic actions (edit, delete, reorder)
    document.addEventListener('click', async (e) => {
      const topicEl = e.target.closest('.topic[data-topic-id]');
      if (!topicEl) return;

      const topicId = parseInt(topicEl.dataset.topicId);

      // Edit topic
      if (e.target.closest('.topic-edit-btn')) {
        e.stopPropagation();
        openTopicModal(null, topicId);
      }

      // Delete topic
      if (e.target.closest('.topic-delete-btn')) {
        e.stopPropagation();
        if (confirm('¿Eliminar este tema y sus subtemas?')) {
          await RoadmapAPI.deleteTopic(topicId);
          await render();
        }
      }

      // Reorder topic
      if (e.target.closest('.topic-move-up')) {
        e.stopPropagation();
        await moveTopic(topicId, -1);
      }
      if (e.target.closest('.topic-move-down')) {
        e.stopPropagation();
        await moveTopic(topicId, 1);
      }
    });
  }

  async function openTopicModal(phaseId = null, topicId = null) {
    const modal = document.getElementById('topic-modal');
    const form = document.getElementById('topic-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('topic-id').value = topicId || '';
    document.getElementById('topic-phase-id').value = phaseId || '';

    if (topicId) {
      const topic = await RoadmapAPI.getTopic(topicId);
      if (topic) {
        document.getElementById('topic-title').value = topic.title;
        document.getElementById('topic-description').value = topic.description || '';
        document.getElementById('topic-status').value = topic.status || 'todo';
        document.getElementById('topic-phase-id').value = topic.phase_id;
      }
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        title: document.getElementById('topic-title').value,
        description: document.getElementById('topic-description').value,
        status: document.getElementById('topic-status').value,
        phase_id: parseInt(document.getElementById('topic-phase-id').value),
      };

      try {
        if (topicId) {
          await RoadmapAPI.updateTopic(topicId, data);
        } else {
          await RoadmapAPI.createTopic(data);
        }
        modal.classList.remove('open');
        await render();
      } catch (err) {
        console.error('[Roadmap] Error saving topic:', err);
        alert('Error al guardar el tema');
      }
    };
  }

  async function moveTopic(topicId, direction) {
    const topics = await RoadmapAPI.getTopics();
    const sorted = topics.sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(t => t.id === topicId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    const orders = sorted.map((t, i) => ({ id: t.id, order: i }));
    [orders[idx], orders[newIdx]] = [orders[newIdx], orders[idx]];

    await RoadmapAPI.reorderTopics(orders);
    await render();
  }

  // --- SUBTOPIC EVENTS ---
  function bindSubtopicEvents() {
    // Add subtopic buttons
    document.querySelectorAll('.add-subtopic-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const topicId = parseInt(e.target.closest('[data-topic-id]')?.dataset.topicId);
        if (topicId) openSubtopicModal(topicId);
      });
    });

    // Subtopic actions
    document.addEventListener('click', async (e) => {
      const subtopicEl = e.target.closest('.subtopic[data-subtopic-id]');
      if (!subtopicEl) return;

      const subtopicId = parseInt(subtopicEl.dataset.subtopicId);

      // Toggle done
      if (e.target.closest('.subtopic-toggle')) {
        e.stopPropagation();
        await RoadmapAPI.toggleSubtopic(subtopicId);
        await render();
      }

      // Edit subtopic
      if (e.target.closest('.subtopic-edit-btn')) {
        e.stopPropagation();
        openSubtopicModal(null, subtopicId);
      }

      // Delete subtopic
      if (e.target.closest('.subtopic-delete-btn')) {
        e.stopPropagation();
        if (confirm('¿Eliminar este subtema?')) {
          await RoadmapAPI.deleteSubtopic(subtopicId);
          await render();
        }
      }

      // Reorder subtopic
      if (e.target.closest('.subtopic-move-up')) {
        e.stopPropagation();
        await moveSubtopic(subtopicId, -1);
      }
      if (e.target.closest('.subtopic-move-down')) {
        e.stopPropagation();
        await moveSubtopic(subtopicId, 1);
      }
    });
  }

  async function openSubtopicModal(topicId = null, subtopicId = null) {
    const modal = document.getElementById('subtopic-modal');
    const form = document.getElementById('subtopic-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('subtopic-id').value = subtopicId || '';
    document.getElementById('subtopic-topic-id').value = topicId || '';

    if (subtopicId) {
      const subtopic = await RoadmapAPI.getSubtopic(subtopicId);
      if (subtopic) {
        document.getElementById('subtopic-title').value = subtopic.title;
        document.getElementById('subtopic-description').value = subtopic.description || '';
        document.getElementById('subtopic-topic-id').value = subtopic.topic_id;
      }
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        title: document.getElementById('subtopic-title').value,
        description: document.getElementById('subtopic-description').value,
        topic_id: parseInt(document.getElementById('subtopic-topic-id').value),
      };

      try {
        if (subtopicId) {
          await RoadmapAPI.updateSubtopic(subtopicId, data);
        } else {
          await RoadmapAPI.createSubtopic(data);
        }
        modal.classList.remove('open');
        await render();
      } catch (err) {
        console.error('[Roadmap] Error saving subtopic:', err);
        alert('Error al guardar el subtema');
      }
    };
  }

  async function moveSubtopic(subtopicId, direction) {
    const subtopics = await RoadmapAPI.getSubtopics();
    const sorted = subtopics.sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(s => s.id === subtopicId);
    if (idx === -1) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;

    const orders = sorted.map((s, i) => ({ id: s.id, order: i }));
    [orders[idx], orders[newIdx]] = [orders[newIdx], orders[idx]];

    await RoadmapAPI.reorderSubtopics(orders);
    await render();
  }

  // --- PROJECT EVENTS ---
  function bindProjectEvents() {
    // Add project buttons
    document.querySelectorAll('.add-project-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const phaseId = parseInt(e.target.closest('[data-phase-id]')?.dataset.phaseId);
        if (phaseId) openProjectModal(phaseId);
      });
    });

    // Project actions
    document.addEventListener('click', async (e) => {
      const projectEl = e.target.closest('.project[data-project-id]');
      if (!projectEl) return;

      const projectId = parseInt(projectEl.dataset.projectId);

      // Edit project
      if (e.target.closest('.project-edit-btn')) {
        e.stopPropagation();
        openProjectModal(null, projectId);
      }

      // Delete project
      if (e.target.closest('.project-delete-btn')) {
        e.stopPropagation();
        if (confirm('¿Eliminar este proyecto?')) {
          await RoadmapAPI.deleteProject(projectId);
          await render();
        }
      }
    });
  }

  async function openProjectModal(phaseId = null, projectId = null) {
    const modal = document.getElementById('project-modal');
    const form = document.getElementById('project-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('project-id').value = projectId || '';
    document.getElementById('project-phase-id').value = phaseId || '';

    if (projectId) {
      const project = await RoadmapAPI.getProject(projectId);
      if (project) {
        document.getElementById('project-repo-name').value = project.repo_name;
        document.getElementById('project-repo-url').value = project.repo_url || '';
        document.getElementById('project-description').value = project.description || '';
        document.getElementById('project-phase-id').value = project.phase_id;
      }
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        repo_name: document.getElementById('project-repo-name').value,
        repo_url: document.getElementById('project-repo-url').value || null,
        description: document.getElementById('project-description').value || null,
        phase_id: parseInt(document.getElementById('project-phase-id').value),
      };

      try {
        if (projectId) {
          await RoadmapAPI.updateProject(projectId, data);
        } else {
          await RoadmapAPI.createProject(data);
        }
        modal.classList.remove('open');
        await render();
      } catch (err) {
        console.error('[Roadmap] Error saving project:', err);
        alert('Error al guardar el proyecto');
      }
    };
  }

  // --- IMPORT EVENTS (roadmap.sh) ---
  function bindImportEvents() {
    const importBtn = document.getElementById('import-roadmap-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => openImportModal());
    }
  }

  async function openImportModal() {
    const modal = document.getElementById('import-modal');
    const form = document.getElementById('import-form');
    if (!modal || !form) return;

    // Load available roadmap.sh roadmaps
    try {
      const roadmaps = await RoadmapAPI.getRoadmapShRoadmaps();
      const select = document.getElementById('import-roadmap-id');
      select.innerHTML = roadmaps.map(r => 
        `<option value="${r.id}">${r.title} (${r.category})</option>`
      ).join('');
    } catch (err) {
      console.error('[Roadmap] Error loading roadmap.sh roadmaps:', err);
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        roadmap_id: document.getElementById('import-roadmap-id').value,
        career_path: document.getElementById('import-career-path').value || null,
        use_ai_enhancement: document.getElementById('import-use-ai').checked,
      };

      try {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Importando...';
        
        await RoadmapAPI.importRoadmapSh(data);
        modal.classList.remove('open');
        await render();
      } catch (err) {
        console.error('[Roadmap] Error importing roadmap:', err);
        alert('Error al importar el roadmap');
      } finally {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Importar';
      }
    };
  }

  // --- AI EVENTS ---
  function bindAIEvents() {
    const aiBtn = document.getElementById('ai-suggest-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', () => openAIModal());
    }
  }

  async function openAIModal() {
    const modal = document.getElementById('ai-modal');
    const form = document.getElementById('ai-form');
    if (!modal || !form) return;

    // Load AI providers
    try {
      const providers = await API.getAIProviders(); // Use existing API for providers
      const select = document.getElementById('ai-provider');
      select.innerHTML = providers
        .filter(p => p.is_active)
        .map(p => `<option value="${p.id}">${p.name} (${p.provider})</option>`)
        .join('');
    } catch (err) {
      console.error('[Roadmap] Error loading AI providers:', err);
    }

    modal.classList.add('open');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        career_path: document.getElementById('ai-career-path').value,
        phase_titles: document.getElementById('ai-phase-titles').value.split(',').map(s => s.trim()).filter(Boolean),
        topic_titles: document.getElementById('ai-topic-titles').value.split(',').map(s => s.trim()).filter(Boolean),
        provider: document.getElementById('ai-provider').value || null,
        model: document.getElementById('ai-model').value || null,
      };

      try {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Generando...';
        
        const result = await RoadmapAPI.suggestResources(data);
        // Display results
        displayAIResults(result.resources);
      } catch (err) {
        console.error('[Roadmap] Error getting AI suggestions:', err);
        alert('Error al obtener sugerencias de IA');
      } finally {
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = false;
        btn.textContent = 'Sugerir Recursos';
      }
    };
  }

  function displayAIResults(resources) {
    const container = document.getElementById('ai-results');
    if (!container) return;
    
    container.innerHTML = resources.map(r => `
      <div class="ai-resource-card">
        <h4>${r.title}</h4>
        <p>${r.description || ''}</p>
        <span class="tag tag-${r.type || 'docs'}">${r.type || 'docs'}</span>
        <a href="${r.url}" target="_blank" class="btn btn-sm">Ver</a>
      </div>
    `).join('');
  }

  // --- REORDER EVENTS (Drag & Drop) ---
  function bindReorderEvents() {
    // Phase reordering
    const phaseContainer = document.querySelector('.spine-nodes');
    if (phaseContainer) {
      new Sortable(phaseContainer, {
        animation: 150,
        handle: '.node-dot',
        onEnd: async (evt) => {
          const phases = await RoadmapAPI.getPhases();
          const sorted = phases.sort((a, b) => a.index - b.index);
          const orders = sorted.map((p, i) => ({ id: p.id, index: i }));
          await RoadmapAPI.reorderPhases(orders);
          await render();
        }
      });
    }

    // Topic reordering within each phase
    document.querySelectorAll('.topic-list').forEach(list => {
      new Sortable(list, {
        animation: 150,
        handle: '.topic-drag-handle',
        onEnd: async (evt) => {
          const topicIds = Array.from(list.querySelectorAll('.topic[data-topic-id]'))
            .map(el => parseInt(el.dataset.topicId));
          const orders = topicIds.map((id, i) => ({ id, order: i }));
          await RoadmapAPI.reorderTopics(orders);
          await render();
        }
      });
    });

    // Subtopic reordering
    document.querySelectorAll('.subtopic-list').forEach(list => {
      new Sortable(list, {
        animation: 150,
        handle: '.subtopic-drag-handle',
        onEnd: async (evt) => {
          const subtopicIds = Array.from(list.querySelectorAll('.subtopic[data-subtopic-id]'))
            .map(el => parseInt(el.dataset.subtopicId));
          const orders = subtopicIds.map((id, i) => ({ id, order: i }));
          await RoadmapAPI.reorderSubtopics(orders);
          await render();
        }
      });
    });
  }

  return { init, render, toggleTopic };
})();
