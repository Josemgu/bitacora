const GenerateRoadmap = (() => {
  'use strict';

  function init() {
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('btn-generate-roadmap')?.addEventListener('click', handleGenerate);
  }

  function handleGenerate() {
    const prompt = document.getElementById('generate-prompt').value.trim();
    const level = document.getElementById('generate-level').value;
    const duration = parseInt(document.getElementById('generate-duration').value);
    if (!prompt) {
      alert('Escribe lo que quieres aprender');
      return;
    }
    generate(prompt, level, duration);
  }

  /**
   * Genera el roadmap con la IA del backend (proveedor activo).
   * El backend crea y activa el roadmap completo (fases → temas → subtemas
   * → recursos) en la base de datos real.
   */
  async function generate(prompt, level, duration) {
    const panel = document.getElementById('generate-result-panel');
    const area = document.getElementById('generate-result-area');
    const tag = document.getElementById('generate-status-tag');
    panel.style.display = '';
    tag.textContent = 'Generando...';
    tag.className = 'tag tag-yellow';
    area.innerHTML = '<div class="empty"><p>Generando roadmap con IA... (puede tardar hasta un minuto)</p></div>';

    const careerPath = `${prompt} (nivel: ${level}, duración: ${duration} meses)`;

    try {
      const roadmap = await API.generateRoadmap(careerPath);
      renderResult(roadmap);
    } catch (err) {
      tag.textContent = 'Error';
      tag.className = 'tag tag-red';
      const detail = err.message || 'Error desconocido';
      area.innerHTML = `
        <div class="empty">
          <p style="color:var(--red)">${escapeHtml(detail)}</p>
          <p style="color:var(--muted);font-size:12px;margin-top:8px">
            Configura un proveedor de IA (con su clave) en la pestaña <strong>Chat IA</strong> o
            <strong>Config</strong> y vuelve a intentar. También puedes importar un roadmap
            desde roadmap.sh en la pestaña <strong>Importar</strong>.
          </p>
        </div>`;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function renderResult(roadmap) {
    const area = document.getElementById('generate-result-area');
    const tag = document.getElementById('generate-status-tag');
    tag.textContent = 'Completado';
    tag.className = 'tag tag-green';

    const phases = roadmap.phases || [];
    const totalTopics = phases.reduce((sum, p) => sum + (p.topics || []).length, 0);

    area.innerHTML = `
      <div style="margin-bottom:16px">
        <h3 style="font-size:18px;margin-bottom:8px">${escapeHtml(roadmap.title)}</h3>
        <p style="color:var(--text-dim);font-size:13px">${phases.length} fases · ${totalTopics} temas · guardado y activado ✓</p>
      </div>
      <div class="topic-list" style="margin-bottom:16px">
        ${phases.map(p => `
          <li class="topic" style="font-size:13px">
            <strong style="color:var(--text)">${escapeHtml(p.title)}</strong>
            <span style="color:var(--muted);font-size:11px">(${(p.topics || []).length} temas)</span>
          </li>
        `).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="btn-view-generated">Ver roadmap</button>
        <button class="btn btn-ghost" id="btn-regenerate">Regenerar</button>
      </div>
    `;
    document.getElementById('btn-view-generated')?.addEventListener('click', async () => {
      if (typeof Roadmap !== 'undefined' && Roadmap.render) await Roadmap.render();
      App.navigate('roadmap');
    });
    document.getElementById('btn-regenerate')?.addEventListener('click', handleGenerate);
  }

  return { init };
})();
