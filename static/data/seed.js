/**
 * =============================================================================
 * SEED DATA — Bitacora App
 * Diario de aprendizaje: 36 meses hacia Cloud Security Engineer
 * =============================================================================
 *
 * Este archivo exporta el objeto SEED_DATA con todos los datos iniciales
 * necesarios para poblar la base de datos / estado de la aplicacion.
 *
 * Tablas incluidas:
 *   - phases            : 8 fases del plan de estudios
 *   - topics            : temas por fase (con estado done/current/todo)
 *   - resources         : recursos reales de cybersecurity/cloud
 *   - projects          : proyectos practicos por fase
 *   - project_requirements : requisitos de evidencia por proyecto
 *   - ai_providers      : plantillas de proveedores de IA
 *   - log_entries       : array vacio (se llena en uso)
 *   - health_events     : array vacio (se llena en uso)
 *   - resource_queue    : array vacio (se llena en uso)
 */

const SEED_DATA = {
  // =========================================================================
  // 1. PHASES — 8 fases del roadmap de 36 meses
  // =========================================================================
  phases: [
    {
      id: 1,
      slug: "fase-0",
      index: 0,
      title: "Base del homelab",
      description: "Hardware, Proxmox, pfSense, VLANs",
      starts_on: "2026-10-01",
      ends_on: "2026-10-31",
      accent: "#3fb950",
      status: "done",
    },
    {
      id: 2,
      slug: "fase-1",
      index: 1,
      title: "Linux + Networking real",
      description: "Hardening, VLANs, Wireshark",
      starts_on: "2026-11-01",
      ends_on: "2027-03-31",
      accent: "#3fb950",
      status: "current",
    },
    {
      id: 3,
      slug: "fase-2",
      index: 2,
      title: "Windows Server + Seguridad ofensiva",
      description: "AD, GPOs, Kerberoasting, Security+",
      starts_on: "2027-04-01",
      ends_on: "2027-08-31",
      accent: "#58a6ff",
      status: "todo",
    },
    {
      id: 4,
      slug: "fase-3",
      index: 3,
      title: "AWS + Infraestructura como codigo",
      description: "Organizations, Terraform, pipelines",
      starts_on: "2027-09-01",
      ends_on: "2028-02-29",
      accent: "#a371f7",
      status: "todo",
    },
    {
      id: 5,
      slug: "fase-4",
      index: 4,
      title: "Docker + Kubernetes",
      description: "Cluster real, GitOps, ArgoCD",
      starts_on: "2028-03-01",
      ends_on: "2028-08-31",
      accent: "#d29922",
      status: "todo",
    },
    {
      id: 6,
      slug: "fase-5",
      index: 5,
      title: "SOC casero + AWS Security",
      description: "Wazuh, Suricata, purple team",
      starts_on: "2028-09-01",
      ends_on: "2029-02-28",
      accent: "#f85149",
      status: "todo",
    },
    {
      id: 7,
      slug: "fase-6",
      index: 6,
      title: "IA aplicada a seguridad",
      description: "RAG local, AI SOC Assistant",
      starts_on: "2029-03-01",
      ends_on: "2029-06-30",
      accent: "#39c5cf",
      status: "todo",
    },
    {
      id: 8,
      slug: "fase-7",
      index: 7,
      title: "Preparacion de empleo",
      description: "Portafolio, CV canadiense, simulacros",
      starts_on: "2029-07-01",
      ends_on: "2029-10-31",
      accent: "#8b949e",
      status: "todo",
    },
  ],

  // =========================================================================
  // 2. TOPICS — Temas por fase con estado de avance
  // =========================================================================
  topics: [
    // --- Fase 0: Base del homelab (phase_id=1) — TODOS done ---
    {
      id: 1,
      phase_id: 1,
      title: "Proxmox VE instalado y configurado",
      status: "done",
      order: 1,
      completed_at: "2026-10-10T00:00:00Z",
      notes: "",
    },
    {
      id: 2,
      phase_id: 1,
      title: "pfSense como firewall/router",
      status: "done",
      order: 2,
      completed_at: "2026-10-15T00:00:00Z",
      notes: "",
    },
    {
      id: 3,
      phase_id: 1,
      title: "4 VLANs definidas: Management, Servers, Users, DMZ",
      status: "done",
      order: 3,
      completed_at: "2026-10-20T00:00:00Z",
      notes: "",
    },

    // --- Fase 1: Linux + Networking real (phase_id=2) ---
    {
      id: 4,
      phase_id: 2,
      title: "CIS Benchmark aplicado manualmente",
      status: "done",
      order: 1,
      completed_at: "2026-11-15T00:00:00Z",
      notes: "",
    },
    {
      id: 5,
      phase_id: 2,
      title: "SSH solo por llave, password auth off",
      status: "done",
      order: 2,
      completed_at: "2026-11-20T00:00:00Z",
      notes: "",
    },
    {
      id: 6,
      phase_id: 2,
      title: "rsyslog centralizado",
      status: "current",
      order: 3,
      completed_at: null,
      notes: "",
    },
    {
      id: 7,
      phase_id: 2,
      title: "Backups con restore verificado",
      status: "todo",
      order: 4,
      completed_at: null,
      notes: "",
    },
    {
      id: 8,
      phase_id: 2,
      title: "Reglas de firewall inter-VLAN en pfSense",
      status: "todo",
      order: 5,
      completed_at: null,
      notes: "",
    },
    {
      id: 9,
      phase_id: 2,
      title: "Wireshark entre VLANs",
      status: "todo",
      order: 6,
      completed_at: null,
      notes: "",
    },

    // --- Fase 2: Windows Server + Seguridad ofensiva (phase_id=3) — TODOS todo ---
    {
      id: 10,
      phase_id: 3,
      title: "Dominio Ortiz Technologies con AD",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 11,
      phase_id: 3,
      title: "GPOs: contrasenas, LAPS, SMBv1 off",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },
    {
      id: 12,
      phase_id: 3,
      title: "Kerberoasting / AS-REP Roasting simulado",
      status: "todo",
      order: 3,
      completed_at: null,
      notes: "",
    },
    {
      id: 13,
      phase_id: 3,
      title: "Security+ certificacion",
      status: "todo",
      order: 4,
      completed_at: null,
      notes: "",
    },

    // --- Fase 3: AWS + Infraestructura como codigo (phase_id=4) — TODOS todo ---
    {
      id: 14,
      phase_id: 4,
      title: "AWS Organizations multi-cuenta",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 15,
      phase_id: 4,
      title: "VPC, subnets, NAT, Security Groups",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },
    {
      id: 16,
      phase_id: 4,
      title: "Terraform con state remoto S3+DynamoDB",
      status: "todo",
      order: 3,
      completed_at: null,
      notes: "",
    },
    {
      id: 17,
      phase_id: 4,
      title: "Pipeline: plan en PR, apply en merge",
      status: "todo",
      order: 4,
      completed_at: null,
      notes: "",
    },

    // --- Fase 4: Docker + Kubernetes (phase_id=5) — TODOS todo ---
    {
      id: 18,
      phase_id: 5,
      title: "Cluster K8s: 1 master + 2 workers",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 19,
      phase_id: 5,
      title: "GitOps con ArgoCD",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },
    {
      id: 20,
      phase_id: 5,
      title: "Trivy escaneando imagenes",
      status: "todo",
      order: 3,
      completed_at: null,
      notes: "",
    },

    // --- Fase 5: SOC casero + AWS Security (phase_id=6) — TODOS todo ---
    {
      id: 21,
      phase_id: 6,
      title: "Wazuh + Suricata + Grafana",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 22,
      phase_id: 6,
      title: "Purple team: acceso -> lateral -> escalacion",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },
    {
      id: 23,
      phase_id: 6,
      title: "Reporte de incidente completo",
      status: "todo",
      order: 3,
      completed_at: null,
      notes: "",
    },

    // --- Fase 6: IA aplicada a seguridad (phase_id=7) — TODOS todo ---
    {
      id: 24,
      phase_id: 7,
      title: "RAG local con Ollama sobre alertas Wazuh",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 25,
      phase_id: 7,
      title: "Explicacion de alertas en lenguaje natural",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },

    // --- Fase 7: Preparacion de empleo (phase_id=8) — TODOS todo ---
    {
      id: 26,
      phase_id: 8,
      title: "8-12 repos documentados",
      status: "todo",
      order: 1,
      completed_at: null,
      notes: "",
    },
    {
      id: 27,
      phase_id: 8,
      title: "CV en formato canadiense",
      status: "todo",
      order: 2,
      completed_at: null,
      notes: "",
    },
    {
      id: 28,
      phase_id: 8,
      title: "Simulacros de entrevista",
      status: "todo",
      order: 3,
      completed_at: null,
      notes: "",
    },
  ],

  // =========================================================================
  // 3. RESOURCES — Recursos reales de cybersecurity/cloud
  // =========================================================================
  resources: [
    {
      id: 1,
      phase_id: 1,
      title: "NetworkChuck",
      url: "https://www.youtube.com/@NetworkChuck",
      description: "Canal de YouTube con tutoriales de redes, seguridad, cloud y homelab de forma entretenida y practica.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: 2,
      phase_id: 1,
      title: "David Bombal",
      url: "https://www.youtube.com/@davidbombal",
      description: "Videos de hacking etico, redes, CCNA, Python para networking y laboratorios practicos.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: 3,
      phase_id: 1,
      title: "English for IT - Cisco",
      url: "https://www.netacad.com/courses/english-for-it1",
      description: "Curso de Cisco NetAcad para mejorar el ingles tecnico, clave para trabajar en Canada.",
      category: "curso",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2026-10-01T00:00:00Z",
    },
    {
      id: 4,
      phase_id: 2,
      title: "Linux Server Hardening: CIS Benchmark",
      url: "https://a7.de/en/wiki/linux-server-hardening-cis-benchmark-ssh-auditd-and-apparmor/",
      description: "Guia completa de hardening de servidores Linux aplicando el CIS Benchmark paso a paso.",
      category: "blog",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: 5,
      phase_id: 2,
      title: "Jeremy's IT Lab - CCNA",
      url: "https://www.youtube.com/@JeremysITLab",
      description: "Curso completo y gratuito de CCNA en YouTube. Redes, subnetting, VLANs, routing — fundamental para networking real.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2026-11-01T00:00:00Z",
    },
    {
      id: 6,
      phase_id: 3,
      title: "Professor Messer Security+",
      url: "https://www.professormesser.com/",
      description: "Material de estudio gratuito y de pago para la certificacion CompTIA Security+. Videos, notas de practica y examenes.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2027-04-01T00:00:00Z",
    },
    {
      id: 7,
      phase_id: 4,
      title: "freeCodeCamp AWS Solutions Architect",
      url: "https://www.youtube.com/watch?v=Ia-UEYYR44s",
      description: "Curso completo de AWS Solutions Architect Associate de freeCodeCamp. Fundamentos de AWS paso a paso.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2027-09-01T00:00:00Z",
    },
    {
      id: 8,
      phase_id: 5,
      title: "TechWorld with Nana - Kubernetes",
      url: "https://www.youtube.com/@TechWorldwithNana",
      description: "Tutoriales de DevOps, Kubernetes, Docker, CI/CD y cloud. Explicaciones claras con diagramas visuales.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2028-03-01T00:00:00Z",
    },
    {
      id: 9,
      phase_id: 6,
      title: "Wazuh SOC Lab",
      url: "https://github.com/marxgoo/Wazuh-SOC-Lab",
      description: "Repositorio de GitHub con la configuracion completa para montar un SOC casero con Wazuh, Suricata y ELK.",
      category: "github",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2028-09-01T00:00:00Z",
    },
    {
      id: 10,
      phase_id: 7,
      title: "RAG with Ollama",
      url: "https://weaviate.io/blog/local-rag-with-ollama-and-weaviate",
      description: "Tutorial de Weaviate para construir un sistema RAG local usando Ollama y Weaviate como vector database.",
      category: "blog",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2029-03-01T00:00:00Z",
    },
    {
      id: 11,
      phase_id: 8,
      title: "Simply Cyber",
      url: "https://www.youtube.com/@SimplyCyber",
      description: "Consejos de carrera en ciberseguridad, simulacros de entrevista, revision de CV y guias de certificaciones.",
      category: "youtube",
      origin: "manual",
      status: "active",
      link_status: "unknown",
      link_checked_at: null,
      link_http_code: null,
      created_at: "2029-07-01T00:00:00Z",
    },
  ],

  // =========================================================================
  // 4. PROJECTS — Proyectos practicos por fase
  // =========================================================================
  projects: [
    {
      id: 1,
      phase_id: 1,
      repo_name: "homelab-cloud-security",
      repo_url: null,
      status: "pending",
    },
    {
      id: 2,
      phase_id: 2,
      repo_name: "linux-hardened-server",
      repo_url: null,
      status: "in_progress",
    },
    {
      id: 3,
      phase_id: 2,
      repo_name: "homelab-network-segmentation",
      repo_url: null,
      status: "pending",
    },
    {
      id: 4,
      phase_id: 3,
      repo_name: "ad-lab-attack-detection",
      repo_url: null,
      status: "pending",
    },
    {
      id: 5,
      phase_id: 4,
      repo_name: "aws-infra-as-code",
      repo_url: null,
      status: "pending",
    },
    {
      id: 6,
      phase_id: 5,
      repo_name: "k8s-homelab-platform",
      repo_url: null,
      status: "pending",
    },
    {
      id: 7,
      phase_id: 6,
      repo_name: "homelab-soc",
      repo_url: null,
      status: "pending",
    },
    {
      id: 8,
      phase_id: 6,
      repo_name: "incident-report",
      repo_url: null,
      status: "pending",
    },
    {
      id: 9,
      phase_id: 7,
      repo_name: "ai-soc-assistant",
      repo_url: null,
      status: "pending",
    },
    {
      id: 10,
      phase_id: 8,
      repo_name: "portfolio",
      repo_url: null,
      status: "pending",
    },
  ],

  // =========================================================================
  // 5. PROJECT REQUIREMENTS — Requisitos de evidencia por proyecto
  // =========================================================================
  project_requirements: [
    // --- linux-hardened-server (project_id=2) ---
    {
      id: 1,
      project_id: 2,
      requirement: "README con topologia y hardware",
      kind: "doc",
      done: false,
      order: 1,
    },
    {
      id: 2,
      project_id: 2,
      requirement: "CIS Benchmark aplicado punto por punto",
      kind: "evidence",
      done: false,
      order: 2,
    },
    {
      id: 3,
      project_id: 2,
      requirement: "SSH solo por llave - mostrar config",
      kind: "evidence",
      done: false,
      order: 3,
    },
    {
      id: 4,
      project_id: 2,
      requirement: "fail2ban, sudo logging, AppArmor",
      kind: "artifact",
      done: false,
      order: 4,
    },
    {
      id: 5,
      project_id: 2,
      requirement: "rsyslog reenviando a servidor central",
      kind: "artifact",
      done: false,
      order: 5,
    },
    {
      id: 6,
      project_id: 2,
      requirement: "Backup restaurado y verificado",
      kind: "evidence",
      done: false,
      order: 6,
    },

    // --- homelab-cloud-security (project_id=1) ---
    {
      id: 7,
      project_id: 1,
      requirement: "README con topologia planeada y hardware",
      kind: "doc",
      done: false,
      order: 1,
    },
    {
      id: 8,
      project_id: 1,
      requirement: "Diagrama de 4 VLANs",
      kind: "evidence",
      done: false,
      order: 2,
    },
    {
      id: 9,
      project_id: 1,
      requirement: "Post de LinkedIn mostrando hardware",
      kind: "doc",
      done: false,
      order: 3,
    },
  ],

  // =========================================================================
  // 6. AI PROVIDERS — Plantillas de proveedores de IA
  // =========================================================================
  ai_providers: [
    {
      id: 1,
      name: "OpenAI",
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      env_key_name: "OPENAI_API_KEY",
      active: false,
    },
    {
      id: 2,
      name: "Anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      model: "claude-3-haiku-20240307",
      env_key_name: "ANTHROPIC_API_KEY",
      active: false,
    },
    {
      id: 3,
      name: "Google",
      endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      model: "gemini-1.5-flash",
      env_key_name: "GOOGLE_API_KEY",
      active: false,
    },
    {
      id: 4,
      name: "Ollama",
      endpoint: "http://localhost:11434/api/chat",
      model: "llama3.2",
      env_key_name: "",
      active: false,
    },
  ],

  // =========================================================================
  // 7. LOG ENTRIES — Registro diario de aprendizaje (vacío al inicio)
  // =========================================================================
  log_entries: [],

  // =========================================================================
  // 8. HEALTH EVENTS — Eventos de salud/fitness (vacío al inicio)
  // =========================================================================
  health_events: [],

  // =========================================================================
  // 9. RESOURCE QUEUE — Cola de recursos por revisar (vacío al inicio)
  // =========================================================================
  resource_queue: [],

  // =========================================================================
  // 10. SUBTOPICS — Subtemas accionables por topic (spec v2)
  // =========================================================================
  subtopics: [
    // --- Fase 0: topic 1 "Proxmox VE instalado y configurado" (done) ---
    { id: 1,  topic_id: 1, title: "Descargar ISO de Proxmox VE",                              order: 1, done: true, done_at: "2026-10-01T00:00:00Z", notes: "" },
    { id: 2,  topic_id: 1, title: "Crear USB booteable con Ventoy/Rufus",                     order: 2, done: true, done_at: "2026-10-02T00:00:00Z", notes: "" },
    { id: 3,  topic_id: 1, title: "Instalar Proxmox en hardware dedicado",                    order: 3, done: true, done_at: "2026-10-04T00:00:00Z", notes: "" },
    { id: 4,  topic_id: 1, title: "Configurar almacenamiento ZFS",                            order: 4, done: true, done_at: "2026-10-07T00:00:00Z", notes: "" },
    { id: 5,  topic_id: 1, title: "Crear VMs iniciales y configurar red",                     order: 5, done: true, done_at: "2026-10-10T00:00:00Z", notes: "" },

    // --- Fase 0: topic 2 "pfSense como firewall/router" (done) ---
    { id: 6,  topic_id: 2, title: "Descargar imagen ISO de pfSense CE",                       order: 1, done: true, done_at: "2026-10-11T00:00:00Z", notes: "" },
    { id: 7,  topic_id: 2, title: "Crear VM en Proxmox con 2 NICs (WAN/LAN)",                 order: 2, done: true, done_at: "2026-10-12T00:00:00Z", notes: "" },
    { id: 8,  topic_id: 2, title: "Configurar interfaces WAN y LAN",                          order: 3, done: true, done_at: "2026-10-13T00:00:00Z", notes: "" },
    { id: 9,  topic_id: 2, title: "Habilitar DHCP en interfaz LAN",                           order: 4, done: true, done_at: "2026-10-14T00:00:00Z", notes: "" },
    { id: 10, topic_id: 2, title: "Configurar reglas NAT y acceso a internet",                order: 5, done: true, done_at: "2026-10-15T00:00:00Z", notes: "" },

    // --- Fase 0: topic 3 "4 VLANs definidas" (done) ---
    { id: 11, topic_id: 3, title: "Crear VLAN 10 Management en pfSense",                     order: 1, done: true, done_at: "2026-10-16T00:00:00Z", notes: "" },
    { id: 12, topic_id: 3, title: "Crear VLAN 20 Servers en pfSense",                       order: 2, done: true, done_at: "2026-10-17T00:00:00Z", notes: "" },
    { id: 13, topic_id: 3, title: "Crear VLAN 30 Users en pfSense",                         order: 3, done: true, done_at: "2026-10-18T00:00:00Z", notes: "" },
    { id: 14, topic_id: 3, title: "Crear VLAN 40 DMZ en pfSense",                           order: 4, done: true, done_at: "2026-10-19T00:00:00Z", notes: "" },
    { id: 15, topic_id: 3, title: "Configurar trunk port en switch físico",                 order: 5, done: true, done_at: "2026-10-20T00:00:00Z", notes: "" },

    // --- Fase 1: topic 4 "CIS Benchmark aplicado manualmente" (done) ---
    { id: 16, topic_id: 4, title: "Descargar CIS Benchmark para Ubuntu 22.04",              order: 1, done: true, done_at: "2026-11-02T00:00:00Z", notes: "" },
    { id: 17, topic_id: 4, title: "Ejecutar script de auditoría CIS y revisar resultados",  order: 2, done: true, done_at: "2026-11-05T00:00:00Z", notes: "" },
    { id: 18, topic_id: 4, title: "Aplicar reglas de configuración de red y firewall",      order: 3, done: true, done_at: "2026-11-08T00:00:00Z", notes: "" },
    { id: 19, topic_id: 4, title: "Configurar políticas de contraseñas y bloqueo de cuentas",order: 4, done: true, done_at: "2026-11-12T00:00:00Z", notes: "" },
    { id: 20, topic_id: 4, title: "Verificar cumplimiento con scan final",                  order: 5, done: true, done_at: "2026-11-15T00:00:00Z", notes: "" },

    // --- Fase 1: topic 5 "SSH solo por llave, password auth off" (done) ---
    { id: 21, topic_id: 5, title: "Generar par de claves SSH ed25519 local",                order: 1, done: true, done_at: "2026-11-16T00:00:00Z", notes: "" },
    { id: 22, topic_id: 5, title: "Copiar clave pública a todos los servidores",            order: 2, done: true, done_at: "2026-11-17T00:00:00Z", notes: "" },
    { id: 23, topic_id: 5, title: "Editar sshd_config: PasswordAuthentication no",         order: 3, done: true, done_at: "2026-11-18T00:00:00Z", notes: "" },    { id: 24, topic_id: 5, title: "Deshabilitar login como root vía SSH",                   order: 4, done: true, done_at: "2026-11-19T00:00:00Z", notes: "" },
    { id: 25, topic_id: 5, title: "Verificar conexión exclusiva por llave y reiniciar SSH",order: 5, done: true, done_at: "2026-11-20T00:00:00Z", notes: "" },

    // --- Fase 1: topic 6 "rsyslog centralizado" (current - subtemas por hacer) ---
    { id: 26, topic_id: 6, title: "Instalar rsyslog en servidor central (VM Ubuntu)",       order: 1, done: false, done_at: null, notes: "" },
    { id: 27, topic_id: 6, title: "Configurar rsyslog para recibir logs por TCP/UDP",       order: 2, done: false, done_at: null, notes: "" },
    { id: 28, topic_id: 6, title: "Configurar clientes para enviar logs al servidor",       order: 3, done: false, done_at: null, notes: "" },
    { id: 29, topic_id: 6, title: "Crear plantillas de separación de logs por host",        order: 4, done: false, done_at: null, notes: "" },
    { id: 30, topic_id: 6, title: "Verificar ingesta con logger y revisar archivos",        order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 1: topic 7 "Backups con restore verificado" (todo) ---
    { id: 31, topic_id: 7, title: "Instalar y configurar restic/borgbackup",                order: 1, done: false, done_at: null, notes: "" },
    { id: 32, topic_id: 7, title: "Crear repositorio de backups en NAS externo",            order: 2, done: false, done_at: null, notes: "" },
    { id: 33, topic_id: 7, title: "Configurar backup automático diario con cron/systemd",   order: 3, done: false, done_at: null, notes: "" },
    { id: 34, topic_id: 7, title: "Realizar restore de prueba y verificar integridad",      order: 4, done: false, done_at: null, notes: "" },
    { id: 35, topic_id: 7, title: "Documentar procedimiento de recuperación ante desastres",order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 1: topic 8 "Reglas de firewall inter-VLAN en pfSense" (todo) ---
    { id: 36, topic_id: 8, title: "Crear alias de redes para cada VLAN",                    order: 1, done: false, done_at: null, notes: "" },
    { id: 37, topic_id: 8, title: "Permitir tráfico Management → Servers en puertos específicos",order: 2, done: false, done_at: null, notes: "" },
    { id: 38, topic_id: 8, title: "Bloquear Users → Management completamente",              order: 3, done: false, done_at: null, notes: "" },
    { id: 39, topic_id: 8, title: "Configurar reglas DMZ restrictivas (solo 80/443)",      order: 4, done: false, done_at: null, notes: "" },
    { id: 40, topic_id: 8, title: "Testear conectividad entre VLANs y documentar reglas",  order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 1: topic 9 "Wireshark entre VLANs" (todo) ---
    { id: 41, topic_id: 9, title: "Instalar Wireshark en máquina de análisis",              order: 1, done: false, done_at: null, notes: "" },
    { id: 42, topic_id: 9, title: "Configurar port mirroring en switch para captura",       order: 2, done: false, done_at: null, notes: "" },
    { id: 43, topic_id: 9, title: "Capturar tráfico entre VLANs y analizar frames",         order: 3, done: false, done_at: null, notes: "" },
    { id: 44, topic_id: 9, title: "Aplicar filtros por protocolo (TCP/UDP/ICMP)",          order: 4, done: false, done_at: null, notes: "" },
    { id: 45, topic_id: 9, title: "Exportar capturas .pcap para documentación",             order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 2: topic 10 "Dominio Ortiz Technologies con AD" (todo) ---
    { id: 46, topic_id: 10, title: "Instalar Windows Server 2022 como VM en Proxmox",       order: 1, done: false, done_at: null, notes: "" },
    { id: 47, topic_id: 10, title: "Promover servidor a controlador de dominio",            order: 2, done: false, done_at: null, notes: "" },
    { id: 48, topic_id: 10, title: "Crear estructura de OUs por departamento",              order: 3, done: false, done_at: null, notes: "" },
    { id: 49, topic_id: 10, title: "Crear usuarios y grupos de seguridad iniciales",        order: 4, done: false, done_at: null, notes: "" },
    { id: 50, topic_id: 10, title: "Configurar DNS interno y replicación",                  order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 2: topic 11 "GPOs: contrasenas, LAPS, SMBv1 off" (todo) ---
    { id: 51, topic_id: 11, title: "Crear GPO de política de contraseñas complejas",        order: 1, done: false, done_at: null, notes: "" },
    { id: 52, topic_id: 11, title: "Descargar e instalar LAPS en DC y clientes",            order: 2, done: false, done_at: null, notes: "" },
    { id: 53, topic_id: 11, title: "Deshabilitar SMBv1 via GPO en todos los equipos",       order: 3, done: false, done_at: null, notes: "" },
    { id: 54, topic_id: 11, title: "Aplicar GPOs a OUs correspondientes",                   order: 4, done: false, done_at: null, notes: "" },
    { id: 55, topic_id: 11, title: "Verificar aplicación con gpresult /force",              order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 2: topic 12 "Kerberoasting / AS-REP Roasting simulado" (todo) ---
    { id: 56, topic_id: 12, title: "Instalar Rubeus y herramientas de ataque en VM Kali",   order: 1, done: false, done_at: null, notes: "" },
    { id: 57, topic_id: 12, title: "Ejecutar Kerberoasting contra cuentas de servicio SPN",order: 2, done: false, done_at: null, notes: "" },
    { id: 58, topic_id: 12, title: "Ejecutar AS-REP Roasting contra cuentas sin preauth",   order: 3, done: false, done_at: null, notes: "" },
    { id: 59, topic_id: 12, title: "Exportar hashes TGS y crackear con Hashcat offline",    order: 4, done: false, done_at: null, notes: "" },
    { id: 60, topic_id: 12, title: "Documentar mitigaciones y aplicar protecciones",        order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 2: topic 13 "Security+ certificacion" (todo) ---
    { id: 61, topic_id: 13, title: "Completar videos de Professor Messer Security+",        order: 1, done: false, done_at: null, notes: "" },
    { id: 62, topic_id: 13, title: "Realizar exámenes de práctica (Dion/Boson)",            order: 2, done: false, done_at: null, notes: "" },
    { id: 63, topic_id: 13, title: "Repasar áreas débiles identificadas en prácticas",      order: 3, done: false, done_at: null, notes: "" },
    { id: 64, topic_id: 13, title: "Programar examen en centro de certificación",           order: 4, done: false, done_at: null, notes: "" },
    { id: 65, topic_id: 13, title: "Aprobar examen Security+ SY0-701",                      order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 3: topic 14 "AWS Organizations multi-cuenta" (todo) ---
    { id: 66, topic_id: 14, title: "Crear cuenta AWS root con MFA",                         order: 1, done: false, done_at: null, notes: "" },
    { id: 67, topic_id: 14, title: "Configurar AWS Organizations",                          order: 2, done: false, done_at: null, notes: "" },
    { id: 68, topic_id: 14, title: "Crear cuentas miembro dev/prod/security",               order: 3, done: false, done_at: null, notes: "" },
    { id: 69, topic_id: 14, title: "Configurar SCPs básicos de protección",                 order: 4, done: false, done_at: null, notes: "" },
    { id: 70, topic_id: 14, title: "Habilitar consolidated billing",                        order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 3: topic 15 "VPC, subnets, NAT, Security Groups" (todo) ---
    { id: 71, topic_id: 15, title: "Diseñar arquitectura de red con CIDRs",                 order: 1, done: false, done_at: null, notes: "" },
    { id: 72, topic_id: 15, title: "Crear VPC con subnets públicas y privadas",             order: 2, done: false, done_at: null, notes: "" },
    { id: 73, topic_id: 15, title: "Configurar NAT Gateway en subnet pública",              order: 3, done: false, done_at: null, notes: "" },
    { id: 74, topic_id: 15, title: "Definir Security Groups por aplicación",                order: 4, done: false, done_at: null, notes: "" },
    { id: 75, topic_id: 15, title: "Configurar NACLs como segunda capa de defensa",         order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 3: topic 16 "Terraform con state remoto S3+DynamoDB" (todo) ---
    { id: 76, topic_id: 16, title: "Instalar Terraform CLI y configurar provider AWS",      order: 1, done: false, done_at: null, notes: "" },
    { id: 77, topic_id: 16, title: "Crear bucket S3 con versionamiento para state",         order: 2, done: false, done_at: null, notes: "" },
    { id: 78, topic_id: 16, title: "Crear tabla DynamoDB para state locking",               order: 3, done: false, done_at: null, notes: "" },
    { id: 79, topic_id: 16, title: "Configurar backend remoto en terraform block",          order: 4, done: false, done_at: null, notes: "" },
    { id: 80, topic_id: 16, title: "Ejecutar terraform init y verificar state remoto",      order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 3: topic 17 "Pipeline: plan en PR, apply en merge" (todo) ---
    { id: 81, topic_id: 17, title: "Crear repositorio GitHub para infraestructura",         order: 1, done: false, done_at: null, notes: "" },
    { id: 82, topic_id: 17, title: "Configurar GitHub Actions workflow",                    order: 2, done: false, done_at: null, notes: "" },
    { id: 83, topic_id: 17, title: "Implementar terraform plan en pull request",            order: 3, done: false, done_at: null, notes: "" },
    { id: 84, topic_id: 17, title: "Implementar terraform apply en merge a main",           order: 4, done: false, done_at: null, notes: "" },
    { id: 85, topic_id: 17, title: "Configurar notificaciones Slack/Discord de resultados", order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 4: topic 18 "Cluster K8s: 1 master + 2 workers" (todo) ---
    { id: 86, topic_id: 18, title: "Crear 3 VMs en Proxmox para nodos Kubernetes",          order: 1, done: false, done_at: null, notes: "" },
    { id: 87, topic_id: 18, title: "Instalar container runtime (containerd) en todos",      order: 2, done: false, done_at: null, notes: "" },
    { id: 88, topic_id: 18, title: "Inicializar cluster con kubeadm en nodo master",        order: 3, done: false, done_at: null, notes: "" },
    { id: 89, topic_id: 18, title: "Unir workers al cluster con join token",                order: 4, done: false, done_at: null, notes: "" },
    { id: 90, topic_id: 18, title: "Verificar nodos y desplegar CNI (Cilium/Calico)",       order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 4: topic 19 "GitOps con ArgoCD" (todo) ---
    { id: 91, topic_id: 19, title: "Instalar ArgoCD en cluster Kubernetes",                 order: 1, done: false, done_at: null, notes: "" },
    { id: 92, topic_id: 19, title: "Configurar repositorio Git con manifests",              order: 2, done: false, done_at: null, notes: "" },
    { id: 93, topic_id: 19, title: "Crear aplicación en ArgoCD apuntando al repo",          order: 3, done: false, done_at: null, notes: "" },
    { id: 94, topic_id: 19, title: "Habilitar auto-sync para despliegue automático",        order: 4, done: false, done_at: null, notes: "" },
    { id: 95, topic_id: 19, title: "Verificar despliegue automático al hacer push",         order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 4: topic 20 "Trivy escaneando imagenes" (todo) ---
    { id: 96, topic_id: 20, title: "Instalar Trivy en máquina de CI/local",                 order: 1, done: false, done_at: null, notes: "" },
    { id: 97, topic_id: 20, title: "Escaner imágenes locales de Docker",                    order: 2, done: false, done_at: null, notes: "" },
    { id: 98, topic_id: 20, title: "Integrar Trivy en pipeline CI/CD",                      order: 3, done: false, done_at: null, notes: "" },
    { id: 99, topic_id: 20, title: "Configurar políticas de severidad (CRITICAL/HIGH)",    order: 4, done: false, done_at: null, notes: "" },
    { id: 100, topic_id: 20, title: "Generar reportes SARIF y subir a GitHub",              order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 5: topic 21 "Wazuh + Suricata + Grafana" (todo) ---
    { id: 101, topic_id: 21, title: "Instalar Wazuh manager en VM dedicada",                 order: 1, done: false, done_at: null, notes: "" },
    { id: 102, topic_id: 21, title: "Desplegar agentes Wazuh en endpoints Windows/Linux",    order: 2, done: false, done_at: null, notes: "" },
    { id: 103, topic_id: 21, title: "Instalar Suricata como IDS en segmento de red",         order: 3, done: false, done_at: null, notes: "" },
    { id: 104, topic_id: 21, title: "Configurar dashboards Grafana para alertas",            order: 4, done: false, done_at: null, notes: "" },
    { id: 105, topic_id: 21, title: "Crear reglas de correlación entre fuentes",             order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 5: topic 22 "Purple team: acceso -> lateral -> escalacion" (todo) ---
    { id: 106, topic_id: 22, title: "Simular acceso inicial (phishing/exploit público)",     order: 1, done: false, done_at: null, notes: "" },
    { id: 107, topic_id: 22, title: "Ejecutar movimiento lateral entre hosts",               order: 2, done: false, done_at: null, notes: "" },
    { id: 108, topic_id: 22, title: "Escalar privilegios a Domain Admin/local root",         order: 3, done: false, done_at: null, notes: "" },
    { id: 109, topic_id: 22, title: "Documentar detecciones en cada etapa del kill chain",   order: 4, done: false, done_at: null, notes: "" },
    { id: 110, topic_id: 22, title: "Crear playbooks de respuesta para cada técnica",        order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 5: topic 23 "Reporte de incidente completo" (todo) ---
    { id: 111, topic_id: 23, title: "Construir timeline del incidente con timestamps",       order: 1, done: false, done_at: null, notes: "" },
    { id: 112, topic_id: 23, title: "Recopilar artefactos: logs, memoria, disco",            order: 2, done: false, done_at: null, notes: "" },
    { id: 113, topic_id: 23, title: "Analizar impacto y alcance del compromiso",             order: 3, done: false, done_at: null, notes: "" },
    { id: 114, topic_id: 23, title: "Crear recomendaciones de remediación",                  order: 4, done: false, done_at: null, notes: "" },
    { id: 115, topic_id: 23, title: "Publicar reporte en GitHub con formato profesional",    order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 6: topic 24 "RAG local con Ollama sobre alertas Wazuh" (todo) ---
    { id: 116, topic_id: 24, title: "Instalar Ollama y descargar modelo adecuado",           order: 1, done: false, done_at: null, notes: "" },
    { id: 117, topic_id: 24, title: "Configurar base de datos vectorial (Chroma/Weaviate)",  order: 2, done: false, done_at: null, notes: "" },
    { id: 118, topic_id: 24, title: "Crear pipeline de ingesta de alertas Wazuh",            order: 3, done: false, done_at: null, notes: "" },
    { id: 119, topic_id: 24, title: "Implementar retrieval de contexto relevante",           order: 4, done: false, done_at: null, notes: "" },
    { id: 120, topic_id: 24, title: "Configurar generación de respuestas con el modelo",     order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 6: topic 25 "Explicacion de alertas en lenguaje natural" (todo) ---
    { id: 121, topic_id: 25, title: "Diseñar prompts para análisis de alertas de seguridad", order: 1, done: false, done_at: null, notes: "" },
    { id: 122, topic_id: 25, title: "Configurar integración con API de Wazuh",               order: 2, done: false, done_at: null, notes: "" },
    { id: 123, topic_id: 25, title: "Implementar interfaz de chat para consultas",           order: 3, done: false, done_at: null, notes: "" },    { id: 124, topic_id: 25, title: "Testear con alertas reales del entorno",                order: 4, done: false, done_at: null, notes: "" },
    { id: 125, topic_id: 25, title: "Refinar respuestas con feedback manual",                order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 7: topic 26 "8-12 repos documentados" (todo) ---
    { id: 126, topic_id: 26, title: "Auditar repos existentes y listar gaps",                order: 1, done: false, done_at: null, notes: "" },
    { id: 127, topic_id: 26, title: "Crear READMEs profesionales con badges y diagramas",    order: 2, done: false, done_at: null, notes: "" },
    { id: 128, topic_id: 26, title: "Documentar arquitectura de cada proyecto",              order: 3, done: false, done_at: null, notes: "" },
    { id: 129, topic_id: 26, title: "Añadir diagramas Mermaid/ASCII a cada repo",            order: 4, done: false, done_at: null, notes: "" },
    { id: 130, topic_id: 26, title: "Publicar repos en GitHub como portfolio público",       order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 7: topic 27 "CV en formato canadiense" (todo) ---
    { id: 131, topic_id: 27, title: "Investigar formato de CV canadiense ATS-friendly",      order: 1, done: false, done_at: null, notes: "" },
    { id: 132, topic_id: 27, title: "Crear versión en inglés del CV",                        order: 2, done: false, done_at: null, notes: "" },
    { id: 133, topic_id: 27, title: "Adaptar experiencia al mercado canadiense de tech",     order: 3, done: false, done_at: null, notes: "" },
    { id: 134, topic_id: 27, title: "Destacar proyectos de homelab con métricas",            order: 4, done: false, done_at: null, notes: "" },
    { id: 135, topic_id: 27, title: "Revisar CV con mentor o comunidad",                     order: 5, done: false, done_at: null, notes: "" },

    // --- Fase 7: topic 28 "Simulacros de entrevista" (todo) ---
    { id: 136, topic_id: 28, title: "Compilar lista de 50 preguntas técnicas comunes",       order: 1, done: false, done_at: null, notes: "" },
    { id: 137, topic_id: 28, title: "Practicar behavioral questions formato STAR",           order: 2, done: false, done_at: null, notes: "" },
    { id: 138, topic_id: 28, title: "Grabar simulacros en video y autoevaluar",              order: 3, done: false, done_at: null, notes: "" },
    { id: 139, topic_id: 28, title: "Hacer mock interviews con compañeros de estudio",       order: 4, done: false, done_at: null, notes: "" },
    { id: 140, topic_id: 28, title: "Programar entrevistas reales y documentar feedback",    order: 5, done: false, done_at: null, notes: "" },
  ],
};

// ===========================================================================
// Exportacion universal (Node.js + navegador)
// ===========================================================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SEED_DATA };
}

if (typeof window !== "undefined") {
  window.SEED_DATA = SEED_DATA;
}