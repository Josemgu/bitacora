const Projects = (() => {
  'use strict';

  function init() {
    if (document.querySelector('#view-roadmap')) {
      renderForRoadmap();
    }
  }

  function renderForRoadmap() {
    const phases = DB.getAll('phases');
    phases.forEach(phase => {
      const container = document.querySelector(`.projects-phase-${phase.id}`);
      if (!container) return;
      const projects = DB.query('projects', p => p.phase_id === phase.id);
      if (!projects.length) {
        container.innerHTML = '<p style="font-size:12px;color:var(--muted)">Sin proyectos asignados</p>';
        return;
      }
      container.innerHTML = projects.map(p => renderProjectCard(p)).join('');
    });
  }

  function renderProjectCard(project) {
    const reqs = DB.query('project_requirements', r => r.project_id === project.id);
    const doneCount = reqs.filter(r => r.done).length;
    const total = reqs.length || 1;
    const pct = Math.round((doneCount / total) * 100);
    return `
      <div class="panel" style="margin-bottom:8px">
        <div class="panel-head" style="padding:8px 12px">
          <strong style="font-size:13px">${project.repo_name}</strong>
          <span class="tag tag-${project.status === 'done' ? 'green' : project.status === 'in_progress' ? 'blue' : 'yellow'}">
            ${project.status}
          </span>
        </div>
        <div class="panel-body" style="padding:8px 12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div class="bar-bg" style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div class="bar-fill" style="width:${pct}%;height:100%;border-radius:3px;background:var(--green);transition:width .3s"></div>
            </div>
            <span style="font-size:11px;color:var(--muted)">${pct}%</span>
          </div>
          ${reqs.map(r => `
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);cursor:pointer;margin:3px 0">
              <input type="checkbox" ${r.done ? 'checked' : ''} data-req-id="${r.id}" data-project-id="${project.id}">
              <span style="${r.done ? 'text-decoration:line-through;opacity:.6' : ''}">${r.requirement}</span>
              <span class="tag tag-sm" style="margin-left:auto;font-size:10px">${r.kind}</span>
            </label>
          `).join('')}
        </div>
      </div>`;
  }

  function toggleRequirement(projectId, reqId) {
    const req = DB.getById('project_requirements', reqId);
    if (!req) return;
    DB.update('project_requirements', reqId, { done: !req.done });
    renderForRoadmap();
  }

  function getProjectProgress(projectId) {
    const reqs = DB.query('project_requirements', r => r.project_id === projectId);
    const done = reqs.filter(r => r.done).length;
    return { done, total: reqs.length, percent: reqs.length ? Math.round((done / reqs.length) * 100) : 0 };
  }

  return { init, renderForRoadmap, toggleRequirement, getProjectProgress };
})();
