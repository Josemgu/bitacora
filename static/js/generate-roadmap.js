const GenerateRoadmap = (() => {
  'use strict';

  const ROADMAP_TEMPLATES = {
    cloud: {
      title: 'Cloud Security Engineer',
      phases: [
        { title: 'Fundamentos de Redes y Linux', topics: ['TCP/IP y OSI', 'Routing y Switching', 'Linux Administration', 'Bash Scripting', 'Wireshark'] },
        { title: 'Seguridad Ofensiva', topics: ['Pentesting Basics', 'OWASP Top 10', 'Burp Suite', 'Metasploit', 'Privilege Escalation'] },
        { title: 'Seguridad Defensiva', topics: ['SIEM Fundamentals', 'IDS/IPS', 'Log Analysis', 'Incident Response', 'Forensics Basics'] },
        { title: 'Cloud Fundamentos', topics: ['AWS Core Services', 'Azure Fundamentals', 'GCP Basics', 'Cloud Architecture', 'Cost Management'] },
        { title: 'Cloud Security', topics: ['IAM Deep Dive', 'Network Security in Cloud', 'Encryption at Rest/Transit', 'Compliance (SOC2, ISO27001)', 'Cloud Monitoring'] },
        { title: 'DevSecOps', topics: ['CI/CD Security', 'Container Security', 'Infrastructure as Code', 'Kubernetes Security', 'Secrets Management'] },
      ]
    },
    devops: {
      title: 'DevOps Engineer',
      phases: [
        { title: 'Linux y Scripting', topics: ['Linux Administration', 'Bash/Python', 'Git', 'Networking', 'SSH'] },
        { title: 'Containers', topics: ['Docker', 'Docker Compose', 'Container Networking', 'Image Optimization', 'Registry Management'] },
        { title: 'Orchestration', topics: ['Kubernetes', 'Helm', 'Service Mesh', 'Auto-scaling', 'Cluster Management'] },
        { title: 'CI/CD', topics: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'ArgoCD', 'GitOps'] },
        { title: 'IaC', topics: ['Terraform', 'Ansible', 'Pulumi', 'CloudFormation', 'Packer'] },
        { title: 'Observabilidad', topics: ['Prometheus', 'Grafana', 'ELK Stack', 'Distributed Tracing', 'Alerting'] },
      ]
    },
    python: {
      title: 'Python Developer',
      phases: [
        { title: 'Python Basics', topics: ['Variables y Tipos', 'Control Flow', 'Funciones', 'Listas y Diccionarios', 'File I/O'] },
        { title: 'POO', topics: ['Clases y Objetos', 'Herencia', 'Polimorfismo', 'Encapsulacion', 'Magic Methods'] },
        { title: 'Librerias', topics: ['Requests', 'Pandas', 'NumPy', 'BeautifulSoup', 'Flask'] },
        { title: 'Backend', topics: ['Django', 'APIs REST', 'Authentication', 'ORM', 'Testing'] },
        { title: 'Avanzado', topics: ['Decoradores', 'Generadores', 'Asyncio', 'Type Hints', 'Cython'] },
        { title: 'Proyectos', topics: ['Web Scraper', 'API REST', 'Data Pipeline', 'CLI Tool', 'Microservice'] },
      ]
    },
    fullstack: {
      title: 'Full Stack Developer',
      phases: [
        { title: 'HTML/CSS/JS', topics: ['HTML5 Semantico', 'CSS Grid/Flexbox', 'JavaScript ES6+', 'DOM Manipulation', 'Responsive Design'] },
        { title: 'Frontend Framework', topics: ['React', 'State Management', 'Routing', 'API Integration', 'Testing'] },
        { title: 'Backend', topics: ['Node.js', 'Express', 'REST APIs', 'Authentication', 'Middleware'] },
        { title: 'Base de Datos', topics: ['SQL', 'PostgreSQL', 'MongoDB', 'ORM', 'Query Optimization'] },
        { title: 'DevOps', topics: ['Docker', 'CI/CD', 'AWS', 'Monitoring', 'Deployment'] },
        { title: 'Proyectos', topics: ['E-commerce', 'Social Media', 'Real-time Chat', 'CMS', 'Portfolio'] },
      ]
    }
  };

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

  function generate(prompt, level, duration) {
    const panel = document.getElementById('generate-result-panel');
    const area = document.getElementById('generate-result-area');
    const tag = document.getElementById('generate-status-tag');
    panel.style.display = '';
    tag.textContent = 'Generando...';
    tag.className = 'tag tag-yellow';
    area.innerHTML = '<div class="empty"><p>Generando roadmap con IA...</p></div>';

    setTimeout(() => {
      const structure = buildStructure(prompt, level, duration);
      renderResult(structure);
    }, 2000);
  }

  function buildStructure(prompt, level, duration) {
    const lower = prompt.toLowerCase();
    let template = ROADMAP_TEMPLATES.fullstack;
    if (lower.includes('cloud') || lower.includes('aws') || lower.includes('azure') || lower.includes('gcp')) {
      template = ROADMAP_TEMPLATES.cloud;
    } else if (lower.includes('devops') || lower.includes('docker') || lower.includes('kubernetes') || lower.includes('ci/cd')) {
      template = ROADMAP_TEMPLATES.devops;
    } else if (lower.includes('python') || lower.includes('django') || lower.includes('flask')) {
      template = ROADMAP_TEMPLATES.python;
    }
    const numPhases = Math.min(template.phases.length, Math.max(3, Math.ceil(duration / 2)));
    const selectedPhases = template.phases.slice(0, numPhases);
    return {
      title: template.title + (lower.includes('security') ? ' - Security Focus' : ''),
      prompt: prompt,
      level: level,
      duration: duration,
      phases: selectedPhases.map((p, i) => ({
        index: i,
        title: p.title,
        description: `Fase ${i + 1}: ${p.title}`,
        accent: ['#3fb950', '#58a6ff', '#a371f7', '#d29922', '#f85149', '#39c5cf'][i % 6],
        topics: p.topics.map((t, j) => ({
          title: t,
          order: j,
          status: 'todo'
        }))
      }))
    };
  }

  function renderResult(structure) {
    const area = document.getElementById('generate-result-area');
    const tag = document.getElementById('generate-status-tag');
    tag.textContent = 'Completado';
    tag.className = 'tag tag-green';
    const totalTopics = structure.phases.reduce((sum, p) => sum + p.topics.length, 0);
    area.innerHTML = `
      <div style="margin-bottom:16px">
        <h3 style="font-size:18px;margin-bottom:8px">${structure.title}</h3>
        <p style="color:var(--text-dim);font-size:13px">${structure.duration} meses · Nivel: ${structure.level} · ${structure.phases.length} fases · ${totalTopics} temas</p>
      </div>
      <div class="topic-list" style="margin-bottom:16px">
        ${structure.phases.map(p => `
          <li class="topic" style="font-size:13px">
            <strong style="color:var(--text)">${p.title}</strong>
            <span style="color:var(--muted);font-size:11px">(${p.topics.length} temas)</span>
          </li>
        `).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" id="btn-save-generated">Guardar roadmap</button>
        <button class="btn btn-ghost" id="btn-regenerate">Regenerar</button>
      </div>
    `;
    document.getElementById('btn-save-generated')?.addEventListener('click', () => saveGenerated(structure));
    document.getElementById('btn-regenerate')?.addEventListener('click', () => {
      const prompt = document.getElementById('generate-prompt').value.trim();
      const level = document.getElementById('generate-level').value;
      const duration = parseInt(document.getElementById('generate-duration').value);
      generate(prompt, level, duration);
    });
  }

  function saveGenerated(structure) {
    const roadmap = DB.insert('phases', {
      title: structure.title,
      source: 'ai_generated',
      is_active: false
    });
    structure.phases.forEach(p => {
      const phase = DB.insert('phases', {
        roadmap_id: roadmap.id,
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
          order: t.order,
          status: 'todo'
        });
      });
    });
    App.navigate('roadmap');
  }

  return { init };
})();
