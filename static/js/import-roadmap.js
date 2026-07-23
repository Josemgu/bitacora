/**
 * import-roadmap.js — ImportRoadmap module for Bitacora App
 * Handles importing roadmaps from Markdown files and roadmap.sh
 *
 * Uses global namespace: DB, App
 * CSS classes used: .view, .panel, .panel-head, .panel-body, .panel-note,
 *                   .topic-list, .topic, .btn, .btn-primary, .btn-ghost, .btn-sm,
 *                   .input, .select, .field, .tag, .tag-green, .mono, .kicker,
 *                   .empty, .empty-ico, .empty-hint, .empty-sm
 */
const ImportRoadmap = (() => {
  'use strict';

  /* ── DOM refs ────────────────────────────────────────────── */
  let $fileInput, $titleInput, $btnImportMD, $selectSH, $btnImportSH, $previewArea;

  /* ── State ───────────────────────────────────────────────── */
  const state = {
    parsedStructure: null,
    sourceType: null   // 'markdown' | 'roadmapsh'
  };

  /* ── Roadmap.sh pre-defined structures ───────────────────── */
  const ROADMAPS_SH = {
    'devops': {
      title: 'DevOps Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Sistemas Operativos Linux', 'Shell Scripting (Bash)', 'Redes y Protocolos TCP/IP', 'HTTP/HTTPS y DNS', 'Git y Control de Versiones'] },
        { name: 'CI/CD',            topics: ['Conceptos de Integracion Continua', 'Jenkins Pipelines', 'GitHub Actions', 'GitLab CI', 'Artefactos y Releases'] },
        { name: 'Containers',       topics: ['Docker: Imagenes y Contenedores', 'Dockerfile Best Practices', 'Docker Networking', 'Docker Volumes y Storage', 'Docker Registry'] },
        { name: 'Kubernetes',       topics: ['K8s Architecture (Pods, Services)', 'Deployments y ReplicaSets', 'ConfigMaps y Secrets', 'Ingress Controllers', 'Helm Charts'] },
        { name: 'Monitoring',       topics: ['Prometheus y Grafana', 'Logging con ELK/EFK', 'Alertmanager', 'Distributed Tracing (Jaeger)', 'SLIs, SLOs, SLAs'] },
        { name: 'Cloud & IaC',      topics: ['Terraform Basics', 'AWS Core Services (EC2, S3, VPC)', 'CloudFormation / ARM', 'Ansible para Config Management', 'Serverless (Lambda, Functions)'] }
      ]
    },
    'docker': {
      title: 'Docker Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Que es un contenedor vs VM', 'Instalacion de Docker', 'Docker Engine y Daemon', 'Docker CLI basics', 'Docker Hub y Registries'] },
        { name: 'Dockerfile',       topics: ['Sintaxis de Dockerfile', 'Multi-stage builds', 'Layer caching optimization', '.dockerignore', 'Image scanning (Trivy)'] },
        { name: 'Compose',          topics: ['docker-compose.yml syntax', 'Networking entre servicios', 'Volumes persistentes', 'Health checks', 'Override files'] },
        { name: 'Swarm',            topics: ['Modo Swarm y nodos', 'Services y replicas', 'Overlay networks', 'Secrets y Configs', 'Stack deployments'] },
        { name: 'K8s Integration',  topics: ['Container Runtime Interface', 'Pods con Docker images', 'Image Pull Policies', 'Private registries en K8s', 'Sidecar pattern'] },
        { name: 'Produccion',       topics: ['Docker Bench Security', 'Resource limits (cgroups)', 'Log drivers', 'Runtime security (gVisor)', 'Image signing (Notary)'] }
      ]
    },
    'frontend': {
      title: 'Frontend Developer Roadmap',
      phases: [
        { name: 'HTML & CSS',       topics: ['Semantic HTML5', 'CSS Flexbox y Grid', 'Responsive Design', 'CSS Variables y Custom Properties', 'CSS Animations y Transitions'] },
        { name: 'JavaScript',       topics: ['ES6+ Features', 'DOM Manipulation', 'Fetch API y Promises', 'Async/Await', 'Modules (ESM, CommonJS)'] },
        { name: 'Frameworks',       topics: ['React: Components y JSX', 'Vue.js: Composition API', 'State Management (Redux/Pinia)', 'Routing (React Router)', 'SSR/SSG (Next, Nuxt)'] },
        { name: 'Tooling',          topics: ['Vite y Webpack', 'ESLint y Prettier', 'TypeScript', 'Testing (Jest, Vitest)', 'Storybook para UI'] },
        { name: 'Performance',      topics: ['Core Web Vitals', 'Lazy Loading', 'Code Splitting', 'Service Workers', 'PWA concepts'] },
        { name: 'Accesibilidad',    topics: ['WCAG 2.1 Guidelines', 'ARIA attributes', 'Keyboard navigation', 'Screen readers', 'A11y testing tools'] }
      ]
    },
    'backend': {
      title: 'Backend Developer Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['HTTP/REST APIs', 'MVC Architecture', 'Authentication (JWT, OAuth2)', 'Database Design (ER)', 'Caching strategies'] },
        { name: 'Lenguajes',        topics: ['Node.js con Express', 'Python con FastAPI/Django', 'Go con Gin/Fiber', 'Java con Spring Boot', 'Rust con Actix'] },
        { name: 'Bases de Datos',   topics: ['PostgreSQL avanzado', 'MongoDB y document DBs', 'Redis para cache/sessions', 'ORMs (Prisma, SQLAlchemy)', 'Database migrations'] },
        { name: 'API Design',       topics: ['RESTful best practices', 'GraphQL schemas y resolvers', 'API Versioning', 'Rate limiting', 'OpenAPI/Swagger docs'] },
        { name: 'Mensajeria',       topics: ['Message Queues (RabbitMQ)', 'Event-driven con Kafka', 'Pub/Sub patterns', 'Background jobs (Celery)', 'Sagas y CQRS'] },
        { name: 'Produccion',       topics: ['Docker containers', 'CI/CD pipelines', 'Load balancing', 'Observability (logs, metrics)', 'Horizontal scaling'] }
      ]
    },
    'python': {
      title: 'Python Developer Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Sintaxis y estructuras', 'List comprehensions', 'Decorators y closures', 'Manejo de excepciones', 'Context managers (with)'] },
        { name: 'Estandar Library', topics: ['os, sys, pathlib', 'collections, itertools', 'json, csv, pickle', 'logging module', 'unittest y doctest'] },
        { name: 'Web Development',  topics: ['FastAPI y async', 'Django ORM y Admin', 'Flask microframework', 'SQLAlchemy y Alembic', 'Templates (Jinja2)'] },
        { name: 'Data Science',     topics: ['NumPy y Pandas', 'Matplotlib y Seaborn', 'Jupyter Notebooks', 'SciPy y estadistica', 'Data cleaning pipelines'] },
        { name: 'ML & AI',          topics: ['scikit-learn workflows', 'Feature engineering', 'Model evaluation metrics', 'TensorFlow/Keras basics', 'MLOps con MLflow'] },
        { name: 'Testing & Deploy', topics: ['pytest avanzado', 'Coverage y TDD', 'Docker para Python', 'Poetry y gestion de deps', 'Celery para tareas async'] }
      ]
    },
    'cloud': {
      title: 'Cloud Computing Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Modelos: IaaS, PaaS, SaaS', 'Virtualization vs Containers', 'Cloud Providers overview', 'Billing y cost management', 'Shared Responsibility Model'] },
        { name: 'AWS Core',         topics: ['EC2, EBS, AMIs', 'S3, Glacier y Storage', 'VPC, subnets, security groups', 'IAM users, roles, policies', 'CloudWatch y CloudTrail'] },
        { name: 'Azure Core',       topics: ['VMs, App Service', 'Azure Storage (Blob, Files)', 'VNet y NSGs', 'Azure AD y RBAC', 'Monitor y Log Analytics'] },
        { name: 'GCP Core',         topics: ['Compute Engine', 'Cloud Storage y GCS', 'VPC networking', 'IAM y Service Accounts', 'Cloud Monitoring'] },
        { name: 'Serverless',       topics: ['AWS Lambda y API Gateway', 'Azure Functions', 'Cloud Functions GCP', 'Event-driven architectures', 'Step Functions / Workflows'] },
        { name: 'Cloud Native',     topics: ['Kubernetes en cloud (EKS/AKS/GKE)', 'Service Mesh (Istio)', 'Infrastructure as Code', 'Cost optimization', 'Multi-cloud strategies'] }
      ]
    },
    'security': {
      title: 'Cybersecurity Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['CIA Triad', 'Threats, Vulnerabilities, Risks', 'OSI Model para security', 'Linux para pentesting', 'Redes: TCP/IP, ports, firewalls'] },     { name: 'Offensive',        topics: ['Reconnaissance (OSINT)', 'Scanning: Nmap, Masscan', 'Exploitation: Metasploit', 'Web attacks: OWASP Top 10', 'Privilege escalation'] },
        { name: 'Defensive',        topics: ['IDS/IPS (Snort, Suricata)', 'SIEM (Splunk, Wazuh)', 'Endpoint protection (EDR)', 'Hardening OS y servicios', 'Incident response process'] },
        { name: 'AppSec',           topics: ['Secure coding practices', 'SAST/DAST tools', 'Dependency scanning (SCA)', 'API security testing', 'Bug bounty methodology'] },
        { name: 'Cloud Security',   topics: ['Cloud IAM hardening', 'Container security', 'CSPM tools', 'Zero Trust architecture', 'DevSecOps practices'] },
        { name: 'Certificaciones',  topics: ['CompTIA Security+', 'eJPT / eCPPT', 'OSCP preparation', 'CISSP domains overview', 'Practical CTFs y labs'] }
      ]
    },
    'system-design': {
      title: 'System Design Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Horizontal vs Vertical scaling', 'Load balancing algorithms', 'Caching strategies (CDN, Redis)', 'Database scaling (sharding)', 'CAP Theorem'] },
        { name: 'Microservices',    topics: ['Service boundaries y DDD', 'Inter-service communication', 'API Gateway pattern', 'Service Discovery', 'Circuit breaker pattern'] },
        { name: 'Data Layer',       topics: ['SQL vs NoSQL decision', 'Database indexing strategies', 'Read replicas', 'Event sourcing', 'CQRS pattern'] },
        { name: 'Messaging',        topics: ['Message queues architecture', 'Event-driven design', 'Idempotency y exactly-once', 'SAGA pattern', 'Outbox pattern'] },
        { name: 'Reliability',      topics: ['Rate limiting strategies', 'Retry con backoff', 'Graceful degradation', 'Chaos engineering', 'Disaster recovery'] },
        { name: 'Case Studies',     topics: ['Design URL shortener', 'Design Twitter/X feed', 'Design WhatsApp', 'Design Netflix', 'Design Uber'] }
      ]
    },
    'ai-ml': {
      title: 'AI / Machine Learning Roadmap',
      phases: [
        { name: 'Matematicas',      topics: ['Calculo diferencial e integral', 'Algebra lineal (matrices, vectores)', 'Probabilidad y estadistica', 'Optimizacion (gradient descent)', 'Information theory'] },
        { name: 'Python & Tools',   topics: ['NumPy y vectorizacion', 'Pandas y data manipulation', 'Matplotlib/Seaborn viz', 'Jupyter workflows', 'Colab y GPU training'] },
        { name: 'ML Clasico',       topics: ['Regression (linear, logistic)', 'Decision Trees y Random Forest', 'SVM y Kernels', 'Clustering (K-means, DBSCAN)', 'Cross-validation y tuning'] },
        { name: 'Deep Learning',    topics: ['Neural Networks basics', 'Backpropagation', 'CNN para vision', 'RNN/LSTM para secuencias', 'Transformers (attention)'] },
        { name: 'Frameworks',       topics: ['TensorFlow 2.x', 'PyTorch workflows', 'Keras functional API', 'Hugging Face ecosystem', 'ONNX para deployment'] },
        { name: 'MLOps',            topics: ['MLflow experiment tracking', 'Model versioning (DVC)', 'Feature stores', 'Model serving (TF Serving)', 'Monitoring de modelos'] }
      ]
    },
    'react': {
      title: 'React Developer Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['JSX y Virtual DOM', 'Componentes funcionales', 'Props y State', 'Event handling', 'Conditional rendering'] },
        { name: 'Hooks',            topics: ['useState y useEffect', 'useContext para estado global', 'useReducer para logica compleja', 'useMemo y useCallback', 'Custom hooks'] },
        { name: 'State Management', topics: ['Redux Toolkit (RTK)', 'Zustand', 'React Query / TanStack Query', 'Form libraries (React Hook Form)', 'URL state management'] },
        { name: 'Routing',          topics: ['React Router v6', 'Nested routes', 'Route guards', 'Lazy loading routes', 'Data routers'] },
        { name: 'Testing',          topics: ['Testing Library (RTL)', 'Jest configuration', 'Mocking services', 'E2E con Playwright/Cypress', 'Visual regression testing'] },
        { name: 'Produccion',       topics: ['Next.js App Router', 'SSR, SSG, ISR', 'Server Components', 'Vercel deployment', 'Performance optimization'] }
      ]
    }
  };

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    $fileInput    = document.getElementById('import-md-file');
    $titleInput   = document.getElementById('import-md-title');
    $btnImportMD  = document.getElementById('btn-import-md');
    $selectSH     = document.getElementById('import-roadmapsh-select');
    $btnImportSH  = document.getElementById('btn-import-sh');
    $previewArea  = document.getElementById('import-preview-area');

    if (!$fileInput || !$previewArea) return;

    /* Bind markdown import events */
    $fileInput.addEventListener('change', handleFileSelect);
    if ($btnImportMD) {
      $btnImportMD.addEventListener('click', () => {
        $fileInput.click();
      });
    }

    /* Bind roadmap.sh import events */
    if ($btnImportSH) {
      $btnImportSH.addEventListener('click', importFromRoadmapSH);
    }

    /* Poblar el select con el catalogo real del backend */
    if ($selectSH) {
      API.getShRoadmaps().then(list => {
        if (!list || !list.length) return;
        const groups = {};
        list.forEach(r => {
          (groups[r.category] = groups[r.category] || []).push(r);
        });
        let html = '<option value="">-- Selecciona un roadmap --</option>';
        Object.entries(groups).forEach(([cat, items]) => {
          html += '<optgroup label="' + escapeHtml(cat) + '">';
          items.forEach(r => {
            html += '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.title) + '</option>';
          });
          html += '</optgroup>';
        });
        $selectSH.innerHTML = html;
      }).catch(err => console.warn('[Import] No se pudo cargar catalogo:', err));
    }

    /* Clear preview initially */
    renderEmpty();
  }

  /* ── Empty state ─────────────────────────────────────────── */
  function renderEmpty() {
    $previewArea.innerHTML = `
      <div class="empty empty-sm">
        <div class="empty-ico">recursos</div>
        <div class="empty-hint">Selecciona un archivo .md o elige un roadmap de roadmap.sh para ver el preview</div>
      </div>
    `;
    state.parsedStructure = null;
    state.sourceType = null;
  }

  /* ════════════════════════════════════════════════════════════
     IMPORT FROM MARKDOWN
     ════════════════════════════════════════════════════════════ */

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.md')) {
      showError('Por favor selecciona un archivo .md (Markdown)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const structure = parseMarkdown(text);
        if ($titleInput && structure.title) {
          $titleInput.value = structure.title;
        }
        state.parsedStructure = structure;
        state.sourceType = 'markdown';
        renderPreview(structure);
      } catch (err) {
        showError('Error al parsear el markdown: ' + err.message);
      }
    };
    reader.onerror = () => {
      showError('Error al leer el archivo');
    };
    reader.readAsText(file);
  }

  /* Parse markdown text into structured roadmap */
  function parseMarkdown(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let title = 'Roadmap Importado';
    const phases = [];
    let currentPhase = null;

    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.+)$/);
      const h2Match = line.match(/^##\s+(.+)$/);
      const h3Match = line.match(/^###\s+(.+)$/);

      if (h1Match) {
        title = h1Match[1].trim();
        continue;
      }

      if (h2Match) {
        currentPhase = {
          name: h2Match[1].trim(),
          topics: []
        };
        phases.push(currentPhase);
        continue;
      }

      if (h3Match && currentPhase) {
        currentPhase.topics.push(h3Match[1].trim());
      }
    }

    /* If no H2 found but H3 exist, group them into a generic phase */
    if (phases.length === 0) {
      const h3Topics = [];
      for (const line of lines) {
        const h3Match = line.match(/^###\s+(.+)$/);
         if (h3Match) h3Topics.push(h3Match[1].trim());
      }
      if (h3Topics.length > 0) {
        phases.push({ name: 'General', topics: h3Topics });
      }
    }

    if (phases.length === 0) {
      throw new Error('No se encontraron fases (##) ni temas (###) en el archivo');
    }

    return { title, phases };
  }

  /* Render preview of parsed markdown structure */
  function renderPreview(structure) {
    const totalTopics = structure.phases.reduce((sum, p) => sum + p.topics.length, 0);

    let phasesHTML = '';
    for (const phase of structure.phases) {
      const topicsHTML = phase.topics.map(t =>
        `<div class="topic"><span class="mono">&#9656;</span> ${escapeHtml(t)}</div>`
      ).join('');
      phasesHTML += `
        <div style="margin-bottom:12px;">
          <div style="font-weight:600;margin-bottom:4px;color:var(--accent);">${escapeHtml(phase.name)}</div>
          <div class="topic-list">
            ${topicsHTML}
          </div>
        </div>
      `;
    }

    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <span class="kicker">Preview</span>
          <span class="tag tag-green">${structure.phases.length} fases / ${totalTopics} temas</span>
        </div>
        <div class="panel-body">
          <div style="font-size:var(--font-lg);font-weight:700;margin-bottom:12px;">${escapeHtml(structure.title)}</div>
          ${phasesHTML}
        </div>
        <div class="panel-note" style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm btn-block" id="btn-confirm-import-md">
            <span class="mono">&#10003;</span> Confirmar importacion
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-cancel-import-md">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-confirm-import-md').addEventListener('click', () => {
      confirmImport(structure);
    });
    document.getElementById('btn-cancel-import-md').addEventListener('click', () => {
      renderEmpty();
      if ($fileInput) $fileInput.value = '';
      if ($titleInput) $titleInput.value = '';
    });
  }

  /* Save markdown-imported roadmap to DB */
  async function confirmImport(structure) {
    try {
      await saveStructureToDB(structure);
      showSuccess('Roadmap importado correctamente desde Markdown');
      if (typeof Roadmap !== 'undefined' && Roadmap.render) await Roadmap.render();
      App.navigate('roadmap');
    } catch (err) {
      showError('Error al guardar: ' + err.message);
    }
  }

  /* ════════════════════════════════════════════════════════════
     IMPORT FROM ROADMAP.SH
     ════════════════════════════════════════════════════════════ */

  function importFromRoadmapSH() {
    if (!$selectSH) return;
    const slug = $selectSH.value;
    if (!slug) {
      showError('Selecciona un roadmap de la lista');
      return;
    }

    const structure = getRoadmapSHStructure(slug);
    state.parsedStructure = structure;
    state.sourceType = 'roadmapsh';
    renderPreviewFromSH(structure);
  }

  /* Return a pre-defined structure based on slug */
  function getRoadmapSHStructure(slug) {
    if (ROADMAPS_SH[slug]) {
      /* Deep clone to avoid mutations */
      return JSON.parse(JSON.stringify(ROADMAPS_SH[slug]));
    }

    /* Fallback generic structure */
    return {
      title: slug.charAt(0).toUpperCase() + slug.slice(1) + ' Roadmap',
      phases: [
        { name: 'Fundamentos',      topics: ['Conceptos basicos', 'Herramientas esenciales', 'Configuracion del entorno', 'Primeros pasos practicos'] },
        { name: 'Intermedio',       topics: ['Patrones comunes', 'Integraciones', 'Testing basico', 'Mejores practicas'] },
        { name: 'Avanzado',         topics: ['Arquitectura avanzada', 'Optimizacion', 'Seguridad', 'Escalabilidad'] },
        { name: 'Especializacion',  topics: ['Casos de uso especificos', 'Herramientas especializadas', 'Comunidad y recursos', 'Proyectos practicos'] }
      ]
    };
  }

  /* Render preview for roadmap.sh import */
  function renderPreviewFromSH(structure) {
    const totalTopics = structure.phases.reduce((sum, p) => sum + p.topics.length, 0);

    let phasesHTML = '';
    for (const phase of structure.phases) {
      const topicsHTML = phase.topics.map(t =>
        `<div class="topic"><span class="mono">&#9656;</span> ${escapeHtml(t)}</div>`
      ).join('');
      phasesHTML += `
        <div style="margin-bottom:12px;">
          <div style="font-weight:600;margin-bottom:4px;color:var(--accent);">${escapeHtml(phase.name)}</div>
          <div class="topic-list">
            ${topicsHTML}
          </div>
        </div>
      `;
    }

    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <span class="kicker">roadmap.sh</span>
          <span class="tag tag-green">${structure.phases.length} fases / ${totalTopics} temas</span>
        </div>
        <div class="panel-body">
          <div style="font-size:var(--font-lg);font-weight:700;margin-bottom:12px;">
            ${escapeHtml(structure.title)}
            <span class="mono" style="font-size:var(--font-sm);color:var(--text-dim);margin-left:8px;">(fuente: roadmap.sh)</span>
          </div>
          ${phasesHTML}
        </div>
        <div class="panel-note" style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm btn-block" id="btn-confirm-import-sh">
            <span class="mono">&#10003;</span> Confirmar importacion
          </button>
          <button class="btn btn-ghost btn-sm" id="btn-cancel-import-sh">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-confirm-import-sh').addEventListener('click', () => {
      confirmImportSH(structure);
    });
    document.getElementById('btn-cancel-import-sh').addEventListener('click', () => {
      renderEmpty();
    });
  }

  /* Save roadmap.sh structure to DB */
  async function confirmImportSH(structure) {
    const slug = $selectSH ? $selectSH.value : null;
    if (!slug) { showError('Selecciona un roadmap de la lista'); return; }
    const $btn = document.getElementById('btn-confirm-import-sh');
    if ($btn) { $btn.disabled = true; $btn.textContent = 'Importando desde roadmap.sh...'; }
    try {
      await API.importShRoadmap({ roadmap_id: slug, use_ai_enhancement: false });
      showSuccess('Roadmap importado correctamente desde roadmap.sh');
      if (typeof Roadmap !== 'undefined' && Roadmap.render) await Roadmap.render();
      App.navigate('roadmap');
    } catch (err) {
      showError('Error al importar: ' + err.message);
      if ($btn) { $btn.disabled = false; $btn.textContent = 'Confirmar importacion'; }
    }
  }

  /* ════════════════════════════════════════════════════════════
     SHARED DB HELPERS
     ════════════════════════════════════════════════════════════ */

  async function saveStructureToDB(structure) {
    /* Crea el roadmap en el backend y lo activa */
    const roadmap = await API.post('/roadmap/?title=' + encodeURIComponent(structure.title || 'Roadmap importado'));

    let phaseOrder = 0;
    for (const phase of structure.phases) {
      const created = await API.createPhase({
        index: phaseOrder++,
        title: phase.name || phase.title || ('Fase ' + phaseOrder),
        description: '',
        accent: '#3fb950',
        status: 'todo'
      });
      for (const topicName of phase.topics) {
        await API.createTopic(created.id, { title: String(topicName), status: 'todo' });
      }
    }

    if (typeof App.updateProgress === 'function') App.updateProgress();
    return roadmap.id;
  }

  /* ════════════════════════════════════════════════════════════
     UTILS
     ════════════════════════════════════════════════════════════ */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showError(msg) {
    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <div style="color:var(--error);font-weight:600;">
            <span class="mono">&#9888;</span> ${escapeHtml(msg)}
          </div>
        </div>
      </div>
    `;
  }

  function showSuccess(msg) {
    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-body">
          <div style="color:var(--success);font-weight:600;">
            <span class="mono">&#10003;</span> ${escapeHtml(msg)}
          </div>
        </div>
      </div>
    `;
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    init,
    parseMarkdown,
    getRoadmapSHStructure
  };
})();