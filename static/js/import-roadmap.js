const ImportRoadmap = (() => {
  'use strict';

  function init() {
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('btn-import-md')?.addEventListener('click', handleImportMD);
    document.getElementById('btn-import-sh')?.addEventListener('click', handleImportSH);
    document.getElementById('import-md-file')?.addEventListener('change', handleFileSelect);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const structure = parseMarkdown(text);
      document.getElementById('import-md-title').value = structure.title || '';
      renderPreview(structure);
    };
    reader.readAsText(file);
  }

  function handleImportMD() {
    const fileInput = document.getElementById('import-md-file');
    const title = document.getElementById('import-md-title').value.trim();
    if (!fileInput.files[0]) {
      alert('Selecciona un archivo .md');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const structure = parseMarkdown(ev.target.result);
      if (title) structure.title = title;
      importStructure(structure);
    };
    reader.readAsText(fileInput.files[0]);
  }

  function handleImportSH() {
    const select = document.getElementById('import-roadmapsh-select');
    const slug = select.value;
    if (!slug) {
      alert('Selecciona un roadmap de roadmap.sh');
      return;
    }
    const structure = getRoadmapSHStructure(slug);
    renderPreview(structure);
    if (confirm('Importar "' + structure.title + '"?')) {
      importStructure(structure);
    }
  }

  function parseMarkdown(text) {
    const lines = text.split('\n');
    let title = 'Roadmap Importado';
    const phases = [];
    let currentPhase = null;
    let currentTopics = [];
    lines.forEach(line => {
      const h1 = line.match(/^#\s+(.+)/);
      const h2 = line.match(/^##\s+(.+)/);
      const h3 = line.match(/^###\s+(.+)/);
      if (h1) {
        title = h1[1].trim();
      } else if (h2) {
        if (currentPhase) {
          currentPhase.topics = currentTopics;
          phases.push(currentPhase);
        }
        currentPhase = { title: h2[1].trim(), topics: [] };
        currentTopics = [];
      } else if (h3 && currentPhase) {
        currentTopics.push({ title: h3[1].trim(), status: 'todo' });
      }
    });
    if (currentPhase) {
      currentPhase.topics = currentTopics;
      phases.push(currentPhase);
    }
    return { title, phases: phases.map((p, i) => ({
      index: i,
      title: p.title,
      description: p.title,
      accent: ['#3fb950', '#58a6ff', '#a371f7', '#d29922', '#f85149', '#39c5cf', '#8b949e'][i % 7],
      topics: p.topics
    }))};
  }

  function getRoadmapSHStructure(slug) {
    const templates = {
      devops: { title: 'DevOps', phases: ['Fundamentos', 'CI/CD', 'Containers', 'Kubernetes', 'Monitoring', 'Cloud'] },
      docker: { title: 'Docker', phases: ['Fundamentos', 'Dockerfile', 'Compose', 'Swarm', 'K8s Integration'] },
      kubernetes: { title: 'Kubernetes', phases: ['Fundamentos', 'Pods', 'Services', 'Deployments', 'Helm', 'Advanced'] },
      aws: { title: 'AWS', phases: ['IAM', 'EC2', 'S3', 'RDS', 'VPC', 'Lambda', 'CloudFormation'] },
      python: { title: 'Python', phases: ['Basics', 'OOP', 'Libraries', 'Web', 'Data', 'Advanced'] },
      'cyber-security': { title: 'Cyber Security', phases: ['Networking', 'Linux', 'Offensive', 'Defensive', 'Cloud Sec', 'Compliance'] },
      golang: { title: 'Go', phases: ['Basics', 'Concurrency', 'Web', 'Testing', 'Advanced'] },
      java: { title: 'Java', phases: ['Basics', 'OOP', 'Collections', 'Spring', 'Advanced'] },
      frontend: { title: 'Frontend', phases: ['HTML/CSS', 'JavaScript', 'React', 'State', 'Advanced'] },
      backend: { title: 'Backend', phases: ['APIs', 'Databases', 'Auth', 'Caching', 'Microservices'] },
    };
    const tmpl = templates[slug] || templates.devops;
    return {
      title: 'Roadmap.sh: ' + tmpl.title,
      phases: tmpl.phases.map((p, i) => ({
        index: i,
        title: p,
        description: p,
        accent: ['#3fb950', '#58a6ff', '#a371f7', '#d29922', '#f85149', '#39c5cf', '#8b949e'][i % 7],
        topics: [
          { title: 'Conceptos fundamentales', status: 'todo' },
          { title: 'Practica hands-on', status: 'todo' },
          { title: 'Proyecto practico', status: 'todo' }
        ]
      }))
    };
  }

  function renderPreview(structure) {
    const area = document.getElementById('import-preview-area');
    const totalTopics = structure.phases.reduce((sum, p) => sum + p.topics.length, 0);
    area.innerHTML = `
      <div style="margin-bottom:12px">
        <h4 style="font-size:16px;margin-bottom:4px">${structure.title}</h4>
        <p style="font-size:12px;color:var(--muted)">${structure.phases.length} fases · ${totalTopics} temas</p>
      </div>
      <ul class="topic-list" style="margin-top:0">
        ${structure.phases.map(p => `
          <li class="topic"><strong>${p.title}</strong> (${p.topics.length} temas)</li>
        `).join('')}
      </ul>
    `;
  }

  function importStructure(structure) {
    structure.phases.forEach((p, i) => {
      const phase = DB.insert('phases', {
        index: p.index,
        title: p.title,
        description: p.description,
        accent: p.accent,
        status: 'todo'
      });
      p.topics.forEach(t => {
        DB.insert('topics', {
          phase_id: phase.id,
          title: t.title,
          order: t.order || 0,
          status: 'todo'
        });
      });
    });
    App.navigate('roadmap');
  }

  return { init };
})();
