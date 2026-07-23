/**
 * ============================================================================
 * discover.js — F5: Descubridor de recursos
 * ============================================================================
 * Busca recursos relevantes para cada fase del roadmap, los evalua con IA,
 * verifica sus links y los encola para revision de Miguel.
 *
 * Flujo:
 *   Miguel elige fase -> "Buscar recursos"
 *     -> Arma consulta desde temas de la fase
 *     -> Busqueda web (API o simulada)
 *     -> Evalua candidatos con IA
 *     -> Descarta duplicados
 *     -> Verifica links (LinkChecker)
 *     -> INSERT en resource_queue
 *     -> Miguel revisa en cola
 *
 * Namespace global: Discover
 * Dependencias: DB (js/db.js), LinkChecker (js/link-checker.js)
 * ============================================================================
 */

const Discover = (() => {
  'use strict';

  /* ──────────────────────── constantes ──────────────────────── */

  const CATEGORIES = ['youtube', 'blog', 'docs', 'curso', 'github', 'lab', 'ingles'];
  const PHASES = ['0', '1', '2', '3', '4', '5', '6', '7'];

  /* Categorias permitidas en la evaluacion */
  const VALID_CATEGORIES = ['youtube', 'blog', 'docs', 'curso', 'github', 'lab', 'ingles'];

  /* Umbral de confianza minima para aceptar un candidato */
  const CONFIDENCE_THRESHOLD = 0.6;

  /* Numero maximo de redirecciones a seguir */
  const MAX_REDIRECTS = 3;

  /* ═══════════════════════════════════════════════════════════════════════
     INICIALIZACION
     ═══════════════════════════════════════════════════════════════════════ */

  function init() {
    console.log('[Discover] Inicializado');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BUSQUEDA PRINCIPAL
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Inicia el proceso completo de descubrimiento para una fase.
   * @param {number} phaseId - ID de la fase
   * @param {number} maxResults - Maximo de resultados a buscar (default: 10)
   * @returns {Promise<{queued: number, rejected: number, errors: number}>}
   */
  async function search(phaseId, maxResults = 10) {
    /* 1. Obtener fase y temas desde el backend */
    let phase, topicTitles;
    try {
      const phases = await API.getPhases();
      phase = phases.find(p => p.id === phaseId);
      if (!phase) {
        console.error('[Discover] Fase no encontrada:', phaseId);
        return { queued: 0, rejected: 0, errors: 1 };
      }
      topicTitles = (phase.topics || []).map(t => t.title);
    } catch (err) {
      console.error('[Discover] Error cargando fase:', err);
      return { queued: 0, rejected: 0, errors: 1 };
    }

    /* 2. Armar query */
    const query = buildQuery(phase, topicTitles);
    console.log('[Discover] Query:', query);
    renderProgress(1, 3, `Buscando en internet: "${_esc(query)}"...`);

    /* 3. Búsqueda REAL en internet (el backend busca y encola) */
    try {
      const res = await API.discoverResources(query, { max_results: maxResults });
      const found = (res.results || []).length;
      const stats = {
        queued: res.queued || 0,
        rejected: Math.max(0, found - (res.queued || 0)),
        errors: 0,
        results: res.results || []
      };
      renderProgress(3, 3,
        `Completado: ${found} encontrados, ${stats.queued} añadidos a la cola`);
      _showSearchSummary(phase, stats);
      if (typeof Queue !== 'undefined' && Queue.renderBadge) Queue.renderBadge();
      console.log('[Discover] Resumen:', stats);
      return stats;
    } catch (err) {
      console.error('[Discover] Error en busqueda:', err);
      renderProgress(0, 3, 'Error: ' + (err.message || 'fallo la busqueda'));
      return { queued: 0, rejected: 0, errors: 1 };
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CONSTRUCCION DE QUERY
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Construye una query de busqueda desde los temas de la fase.
   * @param {Object} phase - Objeto fase de DB
   * @param {string[]} topicTitles - Titulos de los temas
   * @returns {string}
   */
  function buildQuery(phase, topicTitles) {
    const parts = [];

    /* Titulo de la fase como base */
    if (phase.title) {
      parts.push(phase.title);
    }

    /* Temas clave (maximo 4 para no hacer la query muy larga) */
    if (topicTitles && topicTitles.length > 0) {
      const keyTopics = topicTitles.slice(0, 4);
      parts.push(...keyTopics);
    }

    /* Palabras de filtro para mejorar resultados */
    parts.push('tutorial', 'guide');

    /* Unir y limpiar */
    const query = parts.join(' ')
      .replace(/[^a-zA-Z0-9+\s\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return query;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     EVALUACION DE CANDIDATOS (IA)
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Evalua si un candidato es relevante para la fase usando IA.
   * @param {Object} candidate - { title, url, snippet }
   * @param {Object} phase - Objeto fase de DB
   * @param {string[]} topics - Titulos de temas
   * @returns {Object|null} - { relevante, categoria, titulo, descripcion, razon, confianza } o null
   */
  async function evaluateCandidate(candidate, phase, topics) {
    /* Construir prompt de evaluacion */
    const topicsStr = (topics || []).join(', ');
    const prompt = _buildEvaluationPrompt(candidate, phase, topicsStr);

    try {
      /* Llamar a IA */
      let response;

      if (typeof AI !== 'undefined' && AI.chat) {
        /* Usar modulo AI si existe */
        response = await AI.chat(prompt, { temperature: 0.3, json: true });
      } else if (typeof App !== 'undefined' && App.aiChat) {
        /* Usar App.aiChat si existe */
        response = await App.aiChat(prompt);
      } else {
        /* Fallback: evaluacion local basica */
        console.warn('[Discover] No hay modulo de IA disponible, usando evaluacion local');
        return _localEvaluate(candidate, phase, topics);
      }

      /* Parsear respuesta JSON */
      return _parseEvaluationResponse(response);

    } catch (err) {
      console.error('[Discover] Error en evaluateCandidate:', err);
      return null;
    }
  }

  /**
   * Construye el prompt de evaluacion para la IA.
   * @private
   */
  function _buildEvaluationPrompt(candidate, phase, topicsStr) {
    return `Evalua si este recurso sirve para la fase "${phase.title}" del roadmap hacia Cloud Security Engineer.

Temas de la fase: ${topicsStr}
Recurso: ${candidate.title} — ${candidate.url}
Descripcion: ${candidate.snippet || ''}

Responde SOLO con JSON valido (sin markdown, sin comillas externas, sin explicaciones):
{"relevante": true|false, "categoria": "youtube|blog|docs|curso|github|lab|ingles", "titulo": "...", "descripcion": "...", "razon": "...", "confianza": 0.0}

Reglas:
- relevante: true solo si ensena ALGO de los temas de la fase
- categoria: clasifica el tipo de recurso
- confianza: 0.0-1.0, cuanto mayor mejor
- Si confianza < 0.6 → relevante debe ser false`;
  }

  /**
   * Parsea la respuesta JSON de la IA.
   * @private
   */
  function _parseEvaluationResponse(response) {
    if (!response) return null;

    let jsonStr = response;

    /* Si la respuesta tiene bloques markdown de codigo, extraer JSON */
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    /* Limpiar posibles comillas externas o texto adicional */
    jsonStr = jsonStr.trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);

      /* Validar campos requeridos */
      if (typeof parsed.relevante !== 'boolean') return null;
      if (typeof parsed.confianza !== 'number') return null;
      if (!parsed.titulo || typeof parsed.titulo !== 'string') return null;

      /* Aplicar umbral de confianza */
      if (!parsed.relevante || parsed.confianza < CONFIDENCE_THRESHOLD) {
        return null;
      }

      /* Normalizar categoria */
      if (!VALID_CATEGORIES.includes(parsed.categoria)) {
        parsed.categoria = 'blog';
      }

      return {
        relevante: parsed.relevante,
        categoria: parsed.categoria,
        titulo: parsed.titulo.substring(0, 200),
        descripcion: (parsed.descripcion || '').substring(0, 500),
        razon: (parsed.razon || '').substring(0, 500),
        confianza: Math.min(1, Math.max(0, parsed.confianza))
      };

    } catch (parseErr) {
      console.warn('[Discover] JSON mal formado de IA, descartando candidato:', parseErr.message);
      return null;
    }
  }

  /**
   * Evaluacion local basica cuando no hay IA disponible.
   * Usa heuristicas simples de matching de palabras clave.
   * @private
   */
  function _localEvaluate(candidate, phase, topics) {
    const queryWords = [
      ...(phase.title || '').toLowerCase().split(/\s+/),
      ...(topics || []).flatMap(t => t.toLowerCase().split(/\s+/))
    ].filter(w => w.length > 3);

    const content = `${candidate.title || ''} ${candidate.snippet || ''}`.toLowerCase();

    /* Contar matches */
    let matches = 0;
    for (const word of queryWords) {
      if (content.includes(word)) matches++;
    }

    const ratio = queryWords.length > 0 ? matches / queryWords.length : 0;
    const confianza = Math.min(0.95, ratio * 1.5);

    if (confianza < CONFIDENCE_THRESHOLD) {
      return null;
    }

    /* Clasificar categoria por URL */
    let categoria = 'blog';
    const url = (candidate.url || '').toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) categoria = 'youtube';
    else if (url.includes('github.com')) categoria = 'github';
    else if (url.includes('docs.') || url.includes('documentation')) categoria = 'docs';
    else if (url.includes('course') || url.includes('coursera') || url.includes('udemy')) categoria = 'curso';

    return {
      relevante: true,
      categoria,
      titulo: candidate.title || 'Sin titulo',
      descripcion: candidate.snippet || '',
      razon: `Match heuristico: ${Math.round(confianza * 100)}% de palabras clave encontradas`,
      confianza
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     DETECCION DE DUPLICADOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Verifica si una URL ya existe en resources activos o resource_queue pendientes.
   * @param {string} url
   * @returns {boolean}
   */
  function isDuplicate(url) {
    if (!url) return true;

    const normalized = _normalizeUrl(url);

    /* Verificar contra resources activos */
    const resources = DB.getAll('resources');
    for (const r of resources) {
      if (r.status === 'archived') continue;
      if (_normalizeUrl(r.url) === normalized) return true;
    }

    /* Verificar contra resource_queue pendientes */
    const queue = DB.getAll('resource_queue');
    for (const q of queue) {
      if (q.status !== 'pending') continue;
      if (_normalizeUrl(q.url) === normalized) return true;
    }

    return false;
  }

  /**
   * Normaliza una URL para comparacion (sin trailing slash, sin query params, lowercase).
   * @private
   */
  function _normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      /* Solo host + pathname, sin query ni hash */
      let path = parsed.pathname;
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }
      return `${parsed.hostname.toLowerCase()}${path.toLowerCase()}`;
    } catch {
      return url.toLowerCase().replace(/\/+$/, '');
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     ENCOLAR
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Inserta un candidato evaluado en la cola de aprobacion.
   * @param {Object} candidate - Objeto con los datos del candidato
   * @param {number} phaseId - ID de la fase
   * @param {string} foundBy - Quien/sistema encontro el recurso
   * @returns {Object|null} - El registro insertado o null
   */
  function addToQueue(candidate, phaseId, foundBy = 'discover') {
    const record = {
      title: candidate.title || 'Sin titulo',
      url: candidate.url,
      description: candidate.description || '',
      category: candidate.category || candidate.category_suggested || 'blog',
      category_suggested: candidate.category_suggested || candidate.category || 'blog',
      phase: phaseId != null ? phaseId : null,
      phase_suggested: candidate.phase_suggested != null ? candidate.phase_suggested : phaseId,
      reason: candidate.reason || candidate.rationale || '',
      confidence: candidate.confidence != null ? candidate.confidence : 0.5,
      model: candidate.model || 'Discover',
      status: 'pending',
      link_status: candidate.link_status || 'unknown',
      link_http_code: candidate.link_http_code || null,
      found_by: foundBy
    };

    return DB.insert('resource_queue', record);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BUSQUEDA WEB (API real o simulada)
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Ejecuta la busqueda web usando API configurada o modo simulado.
   * @private
   */
  async function _executeSearch(query, maxResults, phase, topicTitles) {
    /* Intentar API real si esta configurada */
    const apiConfig = _getSearchApiConfig();

    if (apiConfig && apiConfig.provider) {
      return _searchWithApi(apiConfig, query, maxResults);
    }

    /* Fallback: modo simulado/demo */
    console.log('[Discover] Usando busqueda simulada (modo demo)');
    return _searchSimulated(query, maxResults, phase, topicTitles);
  }

  /**
   * Obtiene la configuracion de API de busqueda.
   * @private
   */
  function _getSearchApiConfig() {
    /* Buscar en App.config */
    if (typeof App !== 'undefined' && App.config) {
      if (App.config.googleSearchApiKey && App.config.googleSearchEngineId) {
        return {
          provider: 'google',
          apiKey: App.config.googleSearchApiKey,
          engineId: App.config.googleSearchEngineId
        };
      }
      if (App.config.bingSearchApiKey) {
        return {
          provider: 'bing',
          apiKey: App.config.bingSearchApiKey
        };
      }
    }

    /* Buscar en localStorage */
    try {
      const stored = localStorage.getItem('bitacora_search_api');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Busqueda con API externa (Google Custom Search o Bing).
   * @private
   */
  async function _searchWithApi(config, query, maxResults) {
    if (config.provider === 'google') {
      return _searchGoogle(config, query, maxResults);
    }
    if (config.provider === 'bing') {
      return _searchBing(config, query, maxResults);
    }
    return [];
  }

  /**
   * Google Custom Search API.
   * @private
   */
  async function _searchGoogle(config, query, maxResults) {
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(config.apiKey)}&cx=${encodeURIComponent(config.engineId)}&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.items || []).map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet || ''
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Bing Search API.
   * @private
   */
  async function _searchBing(config, query, maxResults) {
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${Math.min(maxResults, 50)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': config.apiKey },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Bing API error: ${response.status}`);
      }

      const data = await response.json();
      return (data.webPages?.value || []).map(item => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet || ''
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /* ──────────────────────── Datos demo por fase ──────────────────────── */

  const DEMO_RESULTS = {
    0: [ /* Fase 0: Base del homelab */
      { title: 'Proxmox VE Beginner Tutorial - Complete Setup Guide', url: 'https://www.youtube.com/watch?v=proxmox-tutorial', snippet: 'Step-by-step guide to install and configure Proxmox VE for your homelab environment' },
      { title: 'pfSense Firewall Configuration Guide', url: 'https://docs.netgate.com/pfsense/', snippet: 'Complete pfSense documentation for firewall and router configuration' },
      { title: 'VLAN Configuration Best Practices', url: 'https://www.youtube.com/watch?v=vlan-guide', snippet: 'How to set up VLANs for network segmentation in your homelab' },
      { title: 'Homelab Network Design - Reddit Wiki', url: 'https://www.reddit.com/r/homelab/wiki/', snippet: 'Community-driven guide for designing your first homelab network' },
      { title: 'Proxmox vs VMware ESXi - Comparison Lab', url: 'https://www.youtube.com/watch?v=proxmox-vs-vmware', snippet: 'Detailed comparison of virtualization platforms for beginners' },
      { title: 'Building a $500 Homelab - Hardware Guide', url: 'https://blog.serverbuilds.net/', snippet: 'Budget-friendly hardware recommendations for your first homelab server' },
      { title: 'pfSense VLAN Routing Tutorial', url: 'https://docs.netgate.com/pfsense/en/latest/book/vlan/', snippet: 'Official documentation for VLAN configuration in pfSense' },
      { title: 'Proxmox Backup Server Setup', url: 'https://www.youtube.com/watch?v=pbs-setup', snippet: 'Configure Proxmox Backup Server for automated VM backups' }
    ],
    1: [ /* Fase 1: Linux + Networking real */
      { title: 'CIS Benchmarks for Ubuntu 22.04 - Step by Step', url: 'https://www.youtube.com/watch?v=cis-ubuntu', snippet: 'Apply CIS security benchmarks manually on Ubuntu server' },
      { title: 'SSH Key-Based Authentication - Linux Hardnening', url: 'https://www.youtube.com/watch?v=ssh-keys', snippet: 'Configure SSH with key-only authentication, disable password login' },
      { title: 'rsyslog Centralized Logging Setup', url: 'https://www.youtube.com/watch?v=rsyslog-centralized', snippet: 'Set up centralized log collection with rsyslog across your network' },
      { title: 'Linux Backup Strategies with restic', url: 'https://www.youtube.com/watch?v=restic-backup', snippet: 'Implement verified backup and restore procedures for Linux systems' },
      { title: 'Wireshark VLAN Traffic Analysis Lab', url: 'https://www.youtube.com/watch?v=wireshark-vlan', snippet: 'Capture and analyze inter-VLAN traffic with Wireshark' },
      { title: 'Linux Hardening Checklist - Practical Guide', url: 'https://github.com/trimstray/the-practical-linux-hardening-guide', snippet: 'Comprehensive Linux hardening guide with practical examples' },
      { title: 'pfSense Firewall Rules Deep Dive', url: 'https://docs.netgate.com/pfsense/en/latest/book/firewall/', snippet: 'Advanced firewall rule configuration for inter-VLAN routing' },
      { title: 'Automating CIS Benchmarks with Ansible', url: 'https://www.youtube.com/watch?v=ansible-cis', snippet: 'Use Ansible to automate CIS benchmark application across servers' }
    ],
    2: [ /* Fase 2: Windows Server + Seguridad ofensiva */
      { title: 'Active Directory Setup - Windows Server 2022', url: 'https://www.youtube.com/watch?v=ad-setup', snippet: 'Configure Active Directory Domain Services on Windows Server' },
      { title: 'Group Policy Objects (GPO) Security Hardening', url: 'https://www.youtube.com/watch?v=gpo-security', snippet: 'Implement password policies, LAPS, and disable SMBv1 via GPO' },
      { title: 'Kerberoasting Attack Simulation - Red Team Lab', url: 'https://www.youtube.com/watch?v=kerberoasting-lab', snippet: 'Simulate Kerberoasting and AS-REP Roasting attacks in your lab' },
      { title: 'CompTIA Security+ SY0-701 Study Guide', url: 'https://www.youtube.com/watch?v=security-plus', snippet: 'Complete study guide for Security+ certification exam' },
      { title: 'TryHackMe: Active Directory Basics', url: 'https://tryhackme.com/module/active-directory-basics', snippet: 'Hands-on labs for learning Active Directory attack techniques' },
      { title: 'Windows Server 2022 Administration Tutorial', url: 'https://www.youtube.com/watch?v=winserver-admin', snippet: 'Full administration course for Windows Server 2022' },
      { title: 'BloodHound - Active Directory Attack Path Analysis', url: 'https://www.youtube.com/watch?v=bloodhound-ad', snippet: 'Use BloodHound to visualize and analyze AD attack paths' },
      { title: 'Security+ Practice Exams and Labs', url: 'https://www.youtube.com/watch?v=security-plus-practice', snippet: 'Practice questions and hands-on labs for Security+ preparation' }
    ],
    3: [ /* Fase 3: AWS + Infraestructura como codigo */
      { title: 'AWS Organizations Multi-Account Setup', url: 'https://www.youtube.com/watch?v=aws-orgs', snippet: 'Configure AWS Organizations with multiple accounts and SCPs' },
      { title: 'AWS VPC Networking Deep Dive', url: 'https://www.youtube.com/watch?v=aws-vpc-deep', snippet: 'Complete guide to VPC, subnets, NAT gateways, and security groups' },
      { title: 'Terraform with Remote State S3 and DynamoDB', url: 'https://www.youtube.com/watch?v=terraform-remote-state', snippet: 'Configure Terraform backend with S3 and DynamoDB for state locking' },
      { title: 'CI/CD Pipeline: Terraform plan on PR, apply on merge', url: 'https://www.youtube.com/watch?v=terraform-cicd', snippet: 'Build a GitHub Actions pipeline for Terraform infrastructure' },
      { title: 'AWS Certified Solutions Architect Course', url: 'https://www.youtube.com/watch?v=aws-saa-course', snippet: 'Complete preparation course for AWS Solutions Architect Associate' },
      { title: 'Terraform AWS Modules Best Practices', url: 'https://www.youtube.com/watch?v=terraform-modules', snippet: 'Organize Terraform code with reusable modules for AWS' },
      { title: 'AWS Landing Zone with Control Tower', url: 'https://www.youtube.com/watch?v=aws-landing-zone', snippet: 'Set up a secure multi-account AWS environment with Control Tower' },
      { title: 'GitHub Actions + Terraform - Complete Workflow', url: 'https://www.youtube.com/watch?v=gh-actions-terraform', snippet: 'Production-ready CI/CD pipeline for Terraform infrastructure' }
    ],
    4: [ /* Fase 4: Docker + Kubernetes */
      { title: 'Kubernetes Cluster Setup: 1 Master + 2 Workers', url: 'https://www.youtube.com/watch?v=k8s-cluster', snippet: 'Install and configure a production-like Kubernetes cluster from scratch' },
      { title: 'GitOps with ArgoCD - Complete Tutorial', url: 'https://www.youtube.com/watch?v=argocd-tutorial', snippet: 'Implement GitOps workflows with ArgoCD for Kubernetes deployments' },
      { title: 'Trivy Container Image Scanning', url: 'https://www.youtube.com/watch?v=trivy-scan', snippet: 'Scan Docker images for vulnerabilities using Trivy in CI pipelines' },
      { title: 'Docker Security Best Practices', url: 'https://www.youtube.com/watch?v=docker-security', snippet: 'Secure Docker containers: non-root users, read-only filesystems, capabilities' },
      { title: 'Kubernetes the Hard Way', url: 'https://github.com/kelseyhightower/kubernetes-the-hard-way', snippet: 'Bootstrap Kubernetes the hard way - best learning resource' },
      { title: 'Helm Charts Tutorial for Beginners', url: 'https://www.youtube.com/watch?v=helm-tutorial', snippet: 'Package and deploy applications to Kubernetes with Helm' },
      { title: 'Kubernetes RBAC and Network Policies', url: 'https://www.youtube.com/watch?v=k8s-rbac', snippet: 'Implement Role-Based Access Control and network segmentation in K8s' },
      { title: 'ArgoCD ApplicationSets and Multi-Cluster', url: 'https://www.youtube.com/watch?v=argocd-appsets', snippet: 'Manage multiple Kubernetes clusters with ArgoCD ApplicationSets' }
    ],
    5: [ /* Fase 5: SOC casero + AWS Security */
      { title: 'Wazuh SIEM Installation and Configuration', url: 'https://www.youtube.com/watch?v=wazuh-siem', snippet: 'Set up Wazuh as your Security Information and Event Management system' },
      { title: 'Suricata IDS/IPS Setup Tutorial', url: 'https://www.youtube.com/watch?v=suricata-setup', snippet: 'Configure Suricata as intrusion detection and prevention system' },
      { title: 'Grafana Dashboards for Security Monitoring', url: 'https://www.youtube.com/watch?v=grafana-security', snippet: 'Create security dashboards in Grafana for SOC monitoring' },
      { title: 'AWS GuardDuty and Security Hub', url: 'https://www.youtube.com/watch?v=aws-guardduty', snippet: 'Configure AWS threat detection and security posture management' },
      { title: 'Purple Team Exercises - Attack and Defense Lab', url: 'https://www.youtube.com/watch?v=purple-team', snippet: 'Simulate both attacker and defender scenarios in your homelab SOC' },
      { title: 'Sigma Rules - Detection as Code', url: 'https://www.youtube.com/watch?v=sigma-rules', snippet: 'Write and implement Sigma rules for threat detection' },
      { title: 'AWS CloudTrail Log Analysis', url: 'https://www.youtube.com/watch?v=cloudtrail-analysis', snippet: 'Analyze AWS CloudTrail logs for security monitoring' },
      { title: 'Building a Home SOC on a Budget', url: 'https://www.youtube.com/watch?v=home-soc', snippet: 'Complete guide to building a security operations center at home' }
    ],
    6: [ /* Fase 6: IA aplicada a seguridad */
      { title: 'Ollama Local LLM Setup for Security', url: 'https://www.youtube.com/watch?v=ollama-security', snippet: 'Run local LLMs with Ollama for security analysis tasks' },
      { title: 'RAG Implementation with Local Documents', url: 'https://www.youtube.com/watch?v=rag-local', snippet: 'Build a Retrieval-Augmented Generation system with local security docs' },
      { title: 'AI SOC Assistant - Automated Triage', url: 'https://www.youtube.com/watch?v=ai-soc', snippet: 'Create an AI assistant for automated security alert triage' },
      { title: 'LangChain for Security Automation', url: 'https://www.youtube.com/watch?v=langchain-security', snippet: 'Use LangChain to build security automation workflows with LLMs' },
      { title: 'Local LLM Security - Air-Gapped Deployment', url: 'https://www.youtube.com/watch?v=local-llm-airgap', snippet: 'Deploy and secure local LLMs in air-gapped environments' },
      { title: 'MITRE ATT&CK Mapping with AI', url: 'https://www.youtube.com/watch?v=mitre-ai', snippet: 'Use AI to automatically map security events to MITRE ATT&CK framework' },
      { title: 'Threat Intelligence Analysis with Local AI', url: 'https://www.youtube.com/watch?v=threat-ai-local', snippet: 'Analyze threat intelligence feeds using local language models' },
      { title: 'Generative AI for Security Report Writing', url: 'https://www.youtube.com/watch?v=ai-reports', snippet: 'Automate security report generation with local AI models' }
    ],
    7: [ /* Fase 7: Preparacion de empleo */
      { title: 'Cloud Security Engineer Interview Questions', url: 'https://www.youtube.com/watch?v=cse-interview', snippet: 'Common interview questions for Cloud Security Engineer positions' },
      { title: 'Building a Cybersecurity Portfolio', url: 'https://www.youtube.com/watch?v=security-portfolio', snippet: 'Create an impressive portfolio to showcase your security projects' },
      { title: 'Canadian Resume Format for Tech Jobs', url: 'https://www.youtube.com/watch?v=canada-resume', snippet: 'Format your CV for Canadian tech job applications' },
      { title: 'Mock Interview - Cloud Security Scenario', url: 'https://www.youtube.com/watch?v=mock-cse', snippet: 'Practice interview with real cloud security scenario questions' },
      { title: 'LinkedIn Optimization for Security Professionals', url: 'https://www.youtube.com/watch?v=linkedin-security', snippet: 'Optimize your LinkedIn profile for cybersecurity recruiters' },
      { title: 'Salary Negotiation for Cybersecurity Roles', url: 'https://www.youtube.com/watch?v=salary-negotiate', snippet: 'Tips for negotiating cybersecurity salaries in Canada' },
      { title: 'Technical Presentation Skills for Engineers', url: 'https://www.youtube.com/watch?v=tech-present', snippet: 'How to present your security projects in interviews' },
      { title: 'Cloud Security Certifications - Which to Get?', url: 'https://www.youtube.com/watch?v=cse-certs', snippet: 'Guide to cloud security certifications valued by employers' }
    ]
  };

  /**
   * Busqueda simulada (modo demo) con resultados predefinidos.
   * @private
   */
  async function _searchSimulated(query, maxResults, phase, topicTitles) {
    /* Simular delay de red */
    await _sleep(800 + Math.random() * 1200);

    const phaseIndex = phase ? phase.index : 0;
    const results = DEMO_RESULTS[phaseIndex] || DEMO_RESULTS[0] || [];

    /* Mezclar y limitar */
    const shuffled = _shuffleArray([...results]);
    return shuffled.slice(0, maxResults).map((r, i) => ({
      ...r,
      /* Agregar variacion para parecer mas realista */
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }));
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UI - DIALOGO DE BUSQUEDA
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Renderiza el dialogo/modal de busqueda de recursos.
   */
  async function renderSearchDialog() {
    const modalId = 'modal-discover';
    let $modal = document.getElementById(modalId);
    if ($modal) {
      $modal.classList.remove('hidden');
      return;
    }

    /* Obtener fases del backend para el select */
    let phases = [];
    try { phases = await API.getPhases(); } catch (e) { console.error('[Discover]', e); }
    const currentPhase = phases.find(p => p.status === 'current') || phases[0];

    $modal = document.createElement('div');
    $modal.id = modalId;
    $modal.className = 'modal-overlay';
    $modal.innerHTML = `
      <div class="modal modal-lg">
        <header class="modal-header">
          <h3>Descubrir recursos</h3>
          <button class="btn btn-ghost btn-sm modal-close" aria-label="Cerrar">&times;</button>
        </header>
        <div class="modal-body">
          <p class="text-muted">La IA buscara recursos relevantes para la fase seleccionada.</p>
          <div class="form-row">
            <div class="form-group">
              <label for="discover-phase">Fase</label>
              <select id="discover-phase" name="phase">
                ${phases.map(p => {
                  const selected = currentPhase && p.id === currentPhase.id ? ' selected' : '';
                  return `<option value="${p.id}"${selected}>F${p.index}: ${p.title}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="discover-max">Max. resultados</label>
              <input type="number" id="discover-max" name="maxResults" value="10" min="1" max="20">
            </div>
          </div>
          <div class="discover-query-preview" id="discover-query-preview"></div>
          <div class="discover-progress-area hidden" id="discover-progress-area">
            <div class="lc-progress-bar">
              <div class="lc-progress-fill" id="discover-progress-fill" style="width: 0%"></div>
            </div>
            <div class="lc-progress-info">
              <span id="discover-progress-text">Listo para buscar</span>
            </div>
          </div>
          <div class="discover-results" id="discover-results"></div>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn btn-ghost modal-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" id="discover-btn-search">Buscar</button>
        </footer>
      </div>
    `;

    document.body.appendChild($modal);

    const closeModal = () => $modal.classList.add('hidden');
    $modal.querySelector('.modal-close').addEventListener('click', closeModal);
    $modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    $modal.addEventListener('click', (e) => { if (e.target === $modal) closeModal(); });

    /* Preview de query al cambiar fase */
    const $phaseSelect = $modal.querySelector('#discover-phase');
    const $queryPreview = $modal.querySelector('#discover-query-preview');

    const updatePreview = () => {
      const phaseId = parseInt($phaseSelect.value, 10);
      const phase = phases.find(p => p.id === phaseId);
      if (!phase) { $queryPreview.innerHTML = ''; return; }
      const topics = (phase.topics || []).map(t => t.title);
      const query = buildQuery(phase, topics);
      $queryPreview.innerHTML = `<small class="text-muted">Query: <code>${_esc(query)}</code></small>`;
    };

    $phaseSelect.addEventListener('change', updatePreview);
    updatePreview();

    /* Boton buscar */
    const $btnSearch = $modal.querySelector('#discover-btn-search');
    $btnSearch.addEventListener('click', async () => {
      const phaseId = parseInt($phaseSelect.value, 10);
      const maxResults = parseInt($modal.querySelector('#discover-max').value, 10) || 10;

      $btnSearch.disabled = true;
      $btnSearch.textContent = 'Buscando...';

      const $progressArea = $modal.querySelector('#discover-progress-area');
      $progressArea.classList.remove('hidden');

      /* Limpiar resultados previos */
      $modal.querySelector('#discover-results').innerHTML = '';

      try {
        const stats = await search(phaseId, maxResults);
        _renderDiscoverResults($modal, stats);
      } catch (err) {
        console.error('[Discover] Error en busqueda:', err);
        $modal.querySelector('#discover-progress-text').textContent = 'Error en la busqueda';
       } finally {
        $btnSearch.disabled = false;
        $btnSearch.textContent = 'Buscar';
      }
    });

    /* Enfocar select */
    setTimeout(() => $phaseSelect.focus(), 50);
  }

  /**
   * Actualiza la barra de progreso en el dialogo.
   * @param {number} current
   * @param {number} total
   * @param {string} message
   */
  function renderProgress(current, total, message) {
    const $fill = document.getElementById('discover-progress-fill');
    const $text = document.getElementById('discover-progress-text');

    if ($fill) {
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      $fill.style.width = `${pct}%`;
    }
    if ($text) {
      $text.textContent = message;
    }
  }

  /**
   * Renderiza los resultados de la busqueda en el modal.
   * @private
   */
  function _renderDiscoverResults($modal, stats) {
    const $results = $modal.querySelector('#discover-results');

    const parts = [];
    if (stats.queued > 0) parts.push(`${stats.queued} recurso${stats.queued > 1 ? 's' : ''} encolado${stats.queued > 1 ? 's' : ''}`);
    if (stats.rejected > 0) parts.push(`${stats.rejected} descartado${stats.rejected > 1 ? 's' : ''}`);
    if (stats.errors > 0) parts.push(`${stats.errors} error${stats.errors > 1 ? 'es' : ''}`);

    const summaryText = parts.join(' · ') || 'Sin resultados';

    $results.innerHTML = `
      <div class="discover-summary">
        <p><strong>${summaryText}</strong></p>
        ${stats.queued > 0 ? '<p><a href="#cola" class="link-queue">Ir a la cola de revision →</a></p>' : ''}
      </div>
    `;

    /* Link a cola */
    const $linkQueue = $results.querySelector('.link-queue');
    if ($linkQueue) {
      $linkQueue.addEventListener('click', (e) => {
        e.preventDefault();
        $modal.classList.add('hidden');
        if (typeof App !== 'undefined' && App.navigate) {
          App.navigate('cola');
        } else {
          window.location.hash = 'cola';
        }
      });
    }
  }

  /**
   * Muestra resumen de busqueda como notificacion.
   * @private
   */
  function _showSearchSummary(phase, stats) {
    let $notif = document.getElementById('discover-notification');
    if (!$notif) {
      $notif = document.createElement('div');
      $notif.id = 'discover-notification';
      $notif.className = 'notification notification-info';
      document.body.appendChild($notif);
    }

    const parts = [];
    if (stats.queued > 0) parts.push(`${stats.queued} encolado${stats.queued > 1 ? 's' : ''}`);
    if (stats.rejected > 0) parts.push(`${stats.rejected} descartado${stats.rejected > 1 ? 's' : ''}`);

    $notif.innerHTML = `
      <span>Descubrimiento F${phase.index}: ${parts.join(' · ') || 'Sin resultados'}</span>
      <button class="notif-close" aria-label="Cerrar">&times;</button>
    `;
    $notif.classList.remove('hidden');

    $notif.querySelector('.notif-close').addEventListener('click', () => {
      $notif.classList.add('hidden');
    });

    setTimeout(() => {
      if ($notif) $notif.classList.add('hidden');
    }, 6000);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HELPERS PRIVADOS
     ═══════════════════════════════════════════════════════════════════════ */

  /**
   * Escapa HTML.
   * @private
   */
  function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /**
   * Promise-based sleep.
   * @private
   */
  function _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mezcla un array (Fisher-Yates shuffle).
   * @private
   */
  function _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     API PUBLICA
     ═══════════════════════════════════════════════════════════════════════ */

  return {
    init,
    search,
    buildQuery,
    evaluateCandidate,
    isDuplicate,
    addToQueue,
    renderSearchDialog,
    renderProgress
  };

})();