/**
 * Messages - Buzon estilo correo (Mailbox v2)
 * Vista: #view-messages
 * Namespace global: Messages
 */
const Messages = (() => {
  'use strict';

  /* ================================================================
     CONSTANTES
     ================================================================ */
  const SENDER_NAME = 'Bitacora IA';
  const SENDER_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  const PREVIEW_LENGTH = 100;

  /* ================================================================
     SEED DATA v2 — 8 mensajes variados y realistas
     Campos: id, kind, subject, body, requires_auth, status, created_at
     ================================================================ */
  const MESSAGES_SEED = [
    {
      id: 'msg_001',
      kind: 'news',
      subject: 'Nueva vulnerabilidad critica en OpenSSL 3.x',
      body: 'Se ha detectado una vulnerabilidad de severidad alta (CVE-2024-XXXX) en OpenSSL 3.x que permite ejecucion remota de codigo. Revisa tus servicios expuestos y actualiza a la version 3.2.1 o superior. Esto afecta directamente a tu homelab si tienes servicios web con TLS.',
      requires_auth: false,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: 'msg_002',
      kind: 'news',
      subject: 'AWS anuncia nuevas regiones en Sudamerica para 2026',
      body: 'Amazon Web Services ha confirmado la apertura de una nueva region en Chile para mediados de 2026. Esto permitira latencias menores a 20ms para servicios cloud en la region y abrira nuevas oportunidades de compliance con datos locales.',
      requires_auth: false,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
    },
    {
      id: 'msg_003',
      kind: 'new_resource',
      subject: 'Nuevo recurso: Kubernetes Security Advanced — requiere tu revision',
      body: 'He encontrado un curso avanzado de seguridad en Kubernetes que se alinea con tu Fase 4. Cubre RBAC, network policies, pod security standards, admission controllers y escaneo de vulnerabilidades con Trivy. El contenido parece de alta calidad y complementa lo que ya tienes en tu roadmap.',
      requires_auth: true,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
    },
    {
      id: 'msg_004',
      kind: 'new_resource',
      subject: 'Laboratorio practico: Purple Team con Wazuh y Atomic Red Team',
      body: 'Encontre un laboratorio hands-on que te guia paso a paso en la simulacion de tecnicas MITRE ATT&CK usando Atomic Red Team mientras Wazuh las detecta en tiempo real. Perfecto para tu Fase 5 (SOC casero). Requiere aprobacion para agregarlo a tu cola de laboratorios.',
      requires_auth: true,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
    },
    {
      id: 'msg_005',
      kind: 'broken_link',
      subject: 'Link roto detectado: "Cloud Security Alliance — Top Threats"',
      body: 'El enlace al recurso "Cloud Security Alliance — Top Threats" que guardaste hace 3 semanas ha devuelto un error 404. Es posible que la pagina haya sido movida o eliminada. Te sugiero buscar una alternativa en el sitio oficial de CSA o archivar este recurso.',
      requires_auth: true,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
    },
    {
      id: 'msg_006',
      kind: 'reminder',
      subject: 'Recordatorio: Examen AWS Certified Security en 3 dias',
      body: 'Tu examen de AWS Certified Security — Specialty esta programado para dentro de 3 dias (18 de julio, 14:00 UTC). Te recomiendo hacer un repaso de los temas clave: IAM policies, KMS, VPC endpoints, GuardDuty y Security Hub. Tambien puedes hacer un practice test de LetsDefend.',
      requires_auth: false,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
    },
    {
      id: 'msg_007',
      kind: 'suggestion',
      subject: 'Sugerencia: Refuerza IAM Policies antes del examen',
      body: 'Basado en tu progreso de estudio, detecte que tus resultados en quizzes relacionados con IAM Policies son un 23% mas bajos que el promedio de otros temas. Te sugiero dedicarle 2 sesiones extras esta semana antes del examen. Puedo generarte ejercicios practicos especificos si quieres.',
      requires_auth: true,
      status: 'unread',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: 'msg_008',
      kind: 'roadmap_update',
      subject: 'Actualizacion: Fase 1 completada al 38% — nuevo hito alcanzado',
      body: 'Has completado exitosamente el modulo "rsyslog centralizado" de tu Fase 1. Tu progreso general del roadmap ha subido de 11% a 12%. Los siguientes temas pendientes son: backups con restore verificado, reglas de firewall inter-VLAN en pfSense y analisis con Wireshark entre VLANs.',
      requires_auth: false,
      status: 'read',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
    }
  ];

  /* ================================================================
     CONFIGURACION DE KINDS (mapeo a labels, colores, iconos)
     ================================================================ */
  const KIND_MAP = {
    news:           { label: 'Noticia',       color: '#58a6ff', dot: 'dot-blue' },
    new_resource:   { label: 'Nuevo recurso', color: '#3fb950', dot: 'dot-green' },
    broken_link:    { label: 'Link roto',     color: '#f85149', dot: 'dot-red' },
    reminder:       { label: 'Recordatorio',  color: '#d29922', dot: 'dot-yellow' },
    suggestion:     { label: 'Sugerencia IA', color: '#a371f7', dot: 'dot-purple' },
    roadmap_update: { label: 'Roadmap',       color: '#39c5cf', dot: 'dot-cyan' }
  };

  /* ================================================================
     ESTADO
     ================================================================ */
  const state = {
    category: 'all',
    messages: [],
    selection: new Set(),
    viewMode: 'list',
    currentDetailId: null
  };

  /* ================================================================
     REFERENCIAS DOM
     ================================================================ */
  let $chips, $list, $badge, $styleInjected;

  /* ================================================================
     CSS DINAMICO (se inyecta una sola vez)
     ================================================================ */
  function injectMailboxCSS() {
    if ($styleInjected) return;
    $styleInjected = true;
    const style = document.createElement('style');  style.id = 'messages-mailbox-css';
    style.textContent = `
      .mailbox-summary { display:flex; align-items:center; gap:16px; padding:14px 18px; background:var(--card); border:1px solid var(--border); border-radius:10px; margin-bottom:16px; }
      .mailbox-summary-progress { flex:1; }
      .mailbox-summary-progress-head { display:flex; justify-content:space-between; align-items:baseline; font-size:12px; color:var(--text-dim); margin-bottom:6px; }
      .mailbox-summary-progress-head strong { font-family:var(--mono); font-size:14px; color:var(--green); }
      .mailbox-summary-info { display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .mailbox-summary-info .btn { white-space:nowrap; }
      .mailbox-unread-count { font-size:13px; color:var(--text-dim); }
      .mailbox-unread-count strong { color:var(--text); font-family:var(--mono); }
      .mailbox-list { display:flex; flex-direction:column; gap:2px; }
      .mail-item { display:grid; grid-template-columns:32px 1fr auto; align-items:center; gap:12px; padding:12px 16px; border-radius:8px; cursor:pointer; transition:background .15s; border:1px solid transparent; }
      .mail-item:hover { background:var(--card); border-color:var(--border); }
      .mail-item.unread { background:rgba(88,166,255,0.04); }
      .mail-item.unread .mail-subject { font-weight:600; color:var(--text); }
      .mail-checkbox-col { display:flex; align-items:center; justify-content:center; }
      .mail-checkbox { width:16px; height:16px; cursor:pointer; accent-color:var(--green); }
      .mail-meta { min-width:0; }
      .mail-sender-row { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted, var(--text-faint)); margin-bottom:3px; }
      .mail-sender-icon { color:var(--blue); display:flex; align-items:center; }
      .mail-subject-row { display:flex; align-items:center; gap:8px; margin-bottom:2px; }
      .mail-subject { font-size:13px; color:var(--text-secondary, var(--text-dim)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .mail-preview { font-size:12px; color:var(--muted, var(--text-faint)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .mail-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
      .mail-date { font-size:11px; color:var(--muted, var(--text-faint)); white-space:nowrap; }
      .mail-dot { width:8px; height:8px; border-radius:50%; background:var(--blue); }
      .mail-dot.read { background:transparent; }
      .mail-kind-tag { font-family:var(--mono); font-size:9.5px; padding:1px 6px; border-radius:4px; border:1px solid var(--border); color:var(--text-faint); }
      .mail-detail { padding:20px; }
      .mail-detail-header { margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border); }
      .mail-detail-sender { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--muted, var(--text-faint)); margin-bottom:8px; }
      .mail-detail-sender-icon { color:var(--blue); }
      .mail-detail-subject { font-size:18px; font-weight:700; margin-bottom:8px; }
      .mail-detail-date { font-size:12px; color:var(--muted, var(--text-faint)); }
      .mail-detail-body { font-size:14px; line-height:1.7; color:var(--text-secondary, var(--text-dim)); }
      .mail-actions { display:flex; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid var(--border); flex-wrap:wrap; }
      .mail-bulk-bar { display:none; align-items:center; gap:10px; padding:10px 16px; background:var(--card); border:1px solid var(--border); border-radius:8px; margin-bottom:10px; }
      .mail-bulk-bar.active { display:flex; }
      .mail-bulk-bar .btn-sm { height:28px; padding:0 10px; font-size:11.5px; }
      .mail-bulk-count { font-size:12px; color:var(--text-dim); }
      .mail-back-btn { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--blue); background:none; border:none; cursor:pointer; margin-bottom:12px; padding:0; }
      .mail-back-btn:hover { color:var(--green); }
      .mailbox-empty .empty { padding:40px 24px; }
    `;
    document.head.appendChild(style);
  }

  /* ================================================================
     HELPERS DOM
     ================================================================ */
  function qs(selector, context) {
    return (context || document).querySelector(selector);
  }

  function qsa(selector, context) {
    return (context || document).querySelectorAll(selector);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ================================================================
     FORMATO DE FECHA RELATIVA
     ================================================================ */
  function formatDate(dateInput) {
    const date = new Date(dateInput);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHr  = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    if (diffHr < 24) return `Hace ${diffHr}h`;
    if (diffDay === 1) return 'Ayer';
    if (diffDay < 7) return `Hace ${diffDay}d`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatExactDate(dateInput) {
    const date = new Date(dateInput);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ================================================================
     SVG ICONS
     ================================================================ */
  function svgIcon(name, size) {
    const s = size || 16;
    const icons = {
      busqueda: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      agregar: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,vg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
      recursos: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      sistema: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      ia: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      youtube: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.46z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>`,
      github: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`,
      flecha_izq: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
      ajustes: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      usuarios: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      check: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      x: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      trash: `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
    };
    return icons[name] || icons['info'];
  }

  /* ================================================================
     MAPEO DE CATEGORIA (compatibilidad con chips HTML existentes)
     ================================================================ */
  const CAT_TO_KIND = {
    'news': 'news',
    'resource': 'new_resource',
    'update': 'roadmap_update',
    'ai_suggestion': 'suggestion',
    'system': 'broken_link'
  };

  const KIND_TO_CAT = {
    'news': 'news',
    'new_resource': 'resource',
    'broken_link': 'system',
    'reminder': 'ai_suggestion',
    'suggestion': 'ai_suggestion',
    'roadmap_update': 'update'
  };

  /* ================================================================
     CATEGORIA (compatibilidad API publica)
     ================================================================ */
  const CATEGORY_MAP = {
    news:          { label: 'Noticias',   icon: 'recursos',  color: 'blue',  dot: 'dot-blue' },
    resource:      { label: 'Recursos',   icon: 'recursos',  color: 'green', dot: 'dot-green' },
    update:        { label: 'Actualiz.',  icon: 'sistema',   color: 'yellow',dot: 'dot-yellow' },
    reminder:      { label: 'Recordat.',  icon: 'info',      color: 'yellow',dot: 'dot-yellow' },
    system:        { label: 'Sistema',    icon: 'sistema',   color: 'red',   dot: 'dot-red' },
    ai_suggestion: { label: 'IA Suger.',  icon: 'ia',        color: 'green', dot: 'dot-green' }
  };r || 'gray'; }
  function getCategoryIcon(cat) { return CATEGORY_MAP[cat]?.icon || 'info'; }

  /* ================================================================
     FILTROS
     ================================================================ */
  function filterMessages() {
    if (state.category === 'all') return state.messages.slice();
    const targetKind = CAT_TO_KIND[state.category];
    if (!targetKind) return state.messages.filter(m => KIND_TO_CAT[m.kind] === state.category);
    return state.messages.filter(m => m.kind === targetKind);
  }

  /* ================================================================
     PROGRESO DEL ROADMAP (lee del sidebar)
     ================================================================ */
  function getRoadmapProgress() {
    const $progressBar = qs('.sidebar-foot .bar-fill');
    if ($progressBar) {
      const width = $progressBar.style.width;
      if (width) return width;
    }
    const $progressStrong = qs('.sidebar-foot .mini-progress-head strong');
    if ($progressStrong) return $progressStrong.textContent;
    return '12%';
  }

  /* ================================================================
     RENDER: TARJETA DE RESUMEN
     ================================================================ */
  function renderSummaryCard() {
    const unread = state.messages.filter(m => m.status === 'unread').length;
    const progress = getRoadmapProgress();

    return [
      '<div class="mailbox-summary">',
        '<div class="mailbox-summary-progress">',
          '<div class="mailbox-summary-progress-head">',
            '<span>Progreso del roadmap</span>',
            '<strong>' + progress + '</strong>',
          '</div>',
          '<div class="bar"><div class="bar-fill" style="width:' + progress + '"></div></div>',
        '</div>',
        '<div class="mailbox-summary-info">',
          '<span class="mailbox-unread-count"><strong>' + unread + '</strong> mensajes sin leer</span>',
          unread > 0 ? '<button class="btn btn-sm btn-ghost" onclick="Messages.markAllRead()">Marcar todos como leidos</button>' : '',
        '</div>',
      '</div>'
    ].join('');
  }

  /* ================================================================
     RENDER: BARRA DE ACCIONES EN LOTE
     ================================================================ */
  function renderBulkBar() {
    const count = state.selection.size;
    const isActive = count > 0 ? 'active' : '';

    return [
      '<div class="mail-bulk-bar ' + isActive + '" id="mail-bulk-bar">',
        '<span class="mail-bulk-count"><strong>' + count + '</strong> seleccionados</span>',
        '<button class="btn btn-sm btn-primary" onclick="Messages.bulkApprove()" title="Aprobar seleccionados">',
          svgIcon('check', 12), ' Aprobar',
        '</button>',
        '<button class="btn btn-sm btn-ghost" onclick="Messages.bulkReject()" title="Rechazar seleccionados" style="color:var(--red);border-color:rgba(248,81,73,0.3)">',
          svgIcon('x', 12), ' Rechazar',
        '</button>',
        '<button class="btn btn-sm btn-ghost" onclick="Messages.clearSelection()" title="Eliminar seleccionados">',
          svgIcon('trash', 12), ' Eliminar',
        '</button>',
      '</div>'
    ].join('');
  }

  /* ================================================================
     RENDER: ITEM DE MENSAJE (fila de inbox)
     ================================================================ */
  function renderMailItem(msg) {
    const kindInfo = KIND_MAP[msg.kind] || KIND_MAP['news'];
    const isUnread = msg.status === 'unread';
    const unreadClass = isUnread ? 'unread' : '';
    const dotClass = isUnread ? '' : 'read';
    const preview = msg.body.length > PREVIEW_LENGTH ? msg.body.substring(0, PREVIEW_LENGTH) + '...' : msg.body;
    const dateStr = formatDate(msg.created_at);
    const isSelected = state.selection.has(msg.id) ? 'checked' : '';
    const tagStyle = kindInfo.color ? 'color:' + kindInfo.color + ';border-color:' + kindInfo.color + '40;background:' + kindInfo.color + '10' : '';

    return [
      '<div class="mail-item ' + unreadClass + '" data-msg-id="' + msg.id + '" onclick="Messages.openMessage(\'' + msg.id + '\')">',
        '<div class="mail-checkbox-col" onclick="event.stopPropagation()">',
          '<input type="checkbox" class="mail-checkbox" data-select="' + msg.id + '" ' + isSelected + ' onchange="Messages.toggleSelection(\'' + msg.id + '\')">',
        '</div>',
        '<div class="mail-meta">',
          '<div class="mail-sender-row">',
            '<span class="mail-sender-icon">' + SENDER_ICON_SVG + '</span>',
            '<span>' + SENDER_NAME + '</span>',
            '<span class="mail-kind-tag" style="' + tagStyle + '">' + kindInfo.label + '</span>',
          '</div>',
          '<div class="mail-subject-row">',
            '<span class="mail-subject">' + escapeHtml(msg.subject) + '</span>',
          '</div>',
          '<div class="mail-preview">' + escapeHtml(preview) + '</div>',
        '</div>',
        '<div class="mail-right">',
          '<span class="mail-date">' + dateStr + '</span>',
          '<div class="mail-dot ' + dotClass + '"></div>',
        '</div>',
      '</div>'
    ].join('');
  }

  /* ================================================================
     RENDER: LISTA DE MENSAJES (bandeja)
     ================================================================ */
  function renderMessageList() {
    const filtered = filterMessages();

    if (filtered.length === 0) {
      return [
        '<div class="mailbox-empty">',
          '<div class="empty">',
            '<div class="empty-ico">' + svgIcon('info', 40) + '</div>',
            '<div class="empty-hint">No hay mensajes en esta categoria.</div>',
          '</div>',
        '</div>'
      ].join('');
    }

    // Ordenar: no leidos primero, luego por fecha descendente
    filtered.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'unread' ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return [
      '<div class="mailbox-list">',
        filtered.map(renderMailItem).join(''),
      '</div>'
    ].join('');
  }

  /* ================================================================
     RENDER: DETALLE DE MENSAJE
     ================================================================ */
  function renderMessageDetail(msgId) {
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return '<div class="mail-detail"><p>Mensaje no encontrado.</p></div>';

    const kindInfo = KIND_MAP[msg.kind] || KIND_MAP['news'];
    const dateStr = formatExactDate(msg.created_at);
    const tagStyle = kindInfo.color ? 'color:' + kindInfo.color + ';border-color:' + kindInfo.color + '40;background:' + kindInfo.color + '10' : '';

    let actionButtons = '';
    if (msg.requires_auth) {
      actionButtons = [',
          '<button class="btn btn-primary" onclick="Messages.approveMessage(\'' + msg.id + '\')">',
            svgIcon('check', 14), ' Aprobar',
          '</button>',
          '<button class="btn btn-ghost" onclick="Messages.rejectMessage(\'' + msg.id + '\')" style="color:var(--red);border-color:rgba(248,81,73,0.3)">',
            svgIcon('x', 14), ' Rechazar',
          '</button>',
          '<button class="btn btn-ghost" onclick="Messages.suggestAlternative(\'' + msg.id + '\')">',
            svgIcon('ia', 14), ' Sugerir otra cosa',
          '</button>',
        '</div>'
      ].join('');
    } else {
      const markReadBtn = msg.status === 'unread' ?
        '<button class="btn btn-primary" onclick="Messages.markRead(\'' + msg.id + '\')">' + svgIcon('check', 14) + ' Marcar como leido</button>' :
        '<button class="btn btn-ghost" disabled>Leido</button>';
      actionButtons = [
        '<div class="mail-actions">',
          markReadBtn,
        '</div>'
      ].join('');
    }

    return [
      '<div class="mail-detail">',
        '<button class="mail-back-btn" onclick="Messages.backToList()">',
          svgIcon('flecha_izq', 14), ' Volver a la bandeja',
        '</button>',
        '<div class="mail-detail-header">',
          '<div class="mail-detail-sender">',
            '<span class="mail-detail-sender-icon">' + SENDER_ICON_SVG + '</span>',
            '<span>' + SENDER_NAME + '</span>',
            '<span class="mail-kind-tag" style="' + tagStyle + '">' + kindInfo.label + '</span>',
          '</div>',
          '<div class="mail-detail-subject">' + escapeHtml(msg.subject) + '</div>',
          '<div class="mail-detail-date">' + dateStr + '</div>',
        '</div>',
        '<div class="mail-detail-body">' + escapeHtml(msg.body).replace(/\n/g, '<br>') + '</div>',
        actionButtons,
      '</div>'
    ].join('');
  }

  /* ================================================================
     RENDER: CHIPS DE CATEGORIA
     ================================================================ */
  function renderChips() {
    if (!$chips) return;

    const categories = [
      { key: 'all', label: 'Todos' }
    ];
    Object.keys(CATEGORY_MAP).forEach(key => {
      categories.push({ key, label: CATEGORY_MAP[key].label });
    });

    $chips.innerHTML = categories.map(cat => {
      const isActive = state.category === cat.key;
      return '<button class="chip chip-sm ' + (isActive ? 'is-on' : '') + '" data-cat="' + cat.key + '">' + escapeHtml(cat.label) + '</button>';
    }).join('');

    // Bind clicks
    $chips.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.cat;
        state.viewMode = 'list';
        state.currentDetailId = null;
        renderChips();
        renderMailbox();
      });
    });
  }

  /* ================================================================
     RENDER: VISTA COMPLETA DEL MAILBOX
     ================================================================ */
  function renderMailbox() {
    if (!$list) return;

    // Chips siempre renderizados
    renderChips();

    let html = '';

    if (state.viewMode === 'detail' && state.currentDetailId) {
      // Vista detalle: no mostrar summary ni bulk
      html = renderMessageDetail(state.currentDetailId);
    } else {
      // Vista lista: summary + bulk bar + lista
      html = [
        renderSummaryCard(),
        renderBulkBar(),
        renderMessageList()
      ].join('');
    }

    $list.innerHTML = html;
    updateBadge();
  }

  /* ================================================================
     RENDER: wrapper legacy (compatibilidad)
     ================================================================ */
  function render() {
    renderMailbox();
  }

  /* ================================================================
     ACCIONES: NAVEGACION
     ================================================================ */
  function openMessage(msgId) {
    // Al abrir, marcar como leido automaticamente
    const idx = state.messages.findIndex(m => m.id === msgId);
    if (idx !== -1 && state.messages[idx].status === 'unread') {
      state.messages[idx].status = 'read';
      try { DB.update('messages', msgId, { status: 'read' }); } catch (e) { /* noop */ }
      updateBadge();
    }

    state.viewMode = 'detail';
    state.currentDetailId = msgId;
    renderMailbox();
  }

  function backToList() {
    state.viewMode = 'list';
    state.currentDetailId = null;
    renderMailbox();
  }

  /* ================================================================
     ACCIONES: SELECCION EN LOTE
     ================================================================ */
  function toggleSelection(msgId) {
    if (state.selection.has(msgId)) {
      state.selection.delete(msgId);
    } else {
      state.selection.add(msgId);
    }
    updateBulkBar();
  }

  function clearSelection() {
    state.selection.clear();
    updateBulkBar();
    renderMailbox();
  }

  function updateBulkBar() {
    const $bar = qs('#mail-bulk-bar');
    if (!$bar) return;
    const count = state.selection.size;
    if (count > 0) {
      $bar.classList.add('active');
    } else {
      $bar.classList.remove('active');
    }
    const $count = $bar.querySelector('.mail-bulk-count');
    if ($count) {
      $count.innerHTML = '<strong>' + count + '</strong> seleccionados';
    }
  }

  /* ================================================================
     ACCIONES: APROBAR / RECHAZAR (individual)
     ================================================================ */
  function approveMessage(msgId) {
    try {
      const idx = state.messages.findIndex(m => m.id === msgId);
      if (idx === -1) return;
      state.messages[idx].status = 'approved';
      try { DB.update('messages', msgId, { status: 'approved' }); } catch (e) { /* noop */ }
      // Simular accion: volver a lista tras breve delay
      backToList();
    } catch (err) {
      console.error('[Messages] approveMessage error:', err);
    }
  }

  function rejectMessage(msgId) {
    try {
      const idx = state.messages.findIndex(m => m.id === msgId);
      if (idx === -1) return;
      state.messages[idx].status = 'rejected';
      try { DB.update('messages', msgId, { status: 'rejected' }); } catch (e) { /* noop */ }
      backToList();
    } catch (err) {
      console.error('[Messages] rejectMessage error:', err);
    }
  }

  function suggestAlternative(msgId) {
    // Abre el chat con contexto del mensaje
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;

    // Navegar a la vista de chat
    window.location.hash = 'chat';

    // Si existe Chat global, intentar enviar contexto
    setTimeout(() => {
      try {
        if (typeof Chat !== 'undefined' && Chat.sendMessage) {ubstring(0, 200);
          Chat.sendMessage(contextMsg);
        }
      } catch (e) {
        console.warn('[Messages] No se pudo enviar contexto al chat:', e);
      }
    }, 300);
  }

  /* ================================================================
     ACCIONES: APROBAR / RECHAZAR EN LOTE
     ================================================================ */
  function bulkApprove() {
    try {
      state.selection.forEach(msgId => {
        const idx = state.messages.findIndex(m => m.id === msgId);
        if (idx !== -1) {
          state.messages[idx].status = 'approved';
          try { DB.update('messages', msgId, { status: 'approved' }); } catch (e) { /* noop */ }
        }
      });
      state.selection.clear();
      renderMailbox();
    } catch (err) {
      console.error('[Messages] bulkApprove error:', err);
    }
  }

  function bulkReject() {
    try {
      state.selection.forEach(msgId => {
        const idx = state.messages.findIndex(m => m.id === msgId);
        if (idx !== -1) {
          state.messages[idx].status = 'rejected';
          try { DB.update('messages', msgId, { status: 'rejected' }); } catch (e) { /* noop */ }
        }
      });
      state.selection.clear();
      renderMailbox();
    } catch (err) {
      console.error('[Messages] bulkReject error:', err);
    }
  }

  /* ================================================================
     ACCIONES: MARCAR LEIDO
     ================================================================ */
  function markRead(id) {
    try {
      const idx = state.messages.findIndex(m => m.id === id);
      if (idx === -1) return;

      state.messages[idx].status = 'read';
      try { DB.update('messages', id, { status: 'read' }); } catch (e) { /* noop */ }

      if (state.viewMode === 'detail') {
        renderMailbox();
      } else {
        renderMailbox();
      }
      updateBadge();
    } catch (err) {
      console.error('[Messages] markRead error:', err);
    }
  }

  function markAllRead() {
    try {
      state.messages.forEach(m => {
        if (m.status === 'unread') {
          m.status = 'read';
          try { DB.update('messages', m.id, { status: 'read' }); } catch (e) { /* noop */ }
        }
      });
      state.selection.clear();
      renderMailbox();
      updateBadge();
    } catch (err) {
      console.error('[Messages] markAllRead error:', err);
    }
  }

  /* ================================================================
     BADGE
     ================================================================ */
  function updateBadge() {
    if (!$badge) return;
    const unread = state.messages.filter(m => m.status === 'unread').length;
    $badge.textContent = unread > 0 ? String(unread) : '';
    $badge.style.display = unread > 0 ? '' : 'none';
  }

  /* ================================================================
     CARGA DESDE DB
     ================================================================ */
  function loadMessages() {
    try {
      const rows = DB.getAll('messages');
      if (rows && rows.length > 0) {
        // Migrar datos v1 a v2 si es necesario
        state.messages = rows.map(migrateV1toV2);
      } else {
        seedIfEmpty();
        const afterSeed = DB.getAll('messages');
        state.messages = (afterSeed || []).map(migrateV1toV2);
      }
    } catch (err) {
      console.warn('[Messages] DB.getAll failed, using seed data in memory:', err);
      state.messages = MESSAGES_SEED.map(m => ({ ...m }));
    }
  }

  /* ================================================================
     MIGRACION v1 -> v2
     ================================================================ */
  function migrateV1toV2(msg) {
    if (!msg) return msg;
    // Si ya tiene el campo 'kind', es v2
    if (msg.kind) return msg;
    // Migrar de v1 (category, title, content, is_read, action_required) a v2
    const kindMap = {
      'news': 'news',
      'resource': 'new_resource',
      'system': 'broken_link',
      'reminder': 'reminder',
      'ai_suggestion': 'suggestion',
      'update': 'roadmap_update'
    };
    return {
      id: msg.id || ('msg_' + Math.random().toString(36).substr(2, 6)),
      kind: kindMap[msg.category] || 'news',
      subject: msg.title || 'Sin asunto',
      body: msg.content || '',
      requires_auth: !!msg.action_required,
      status: msg.is_read ? 'read' : 'unread',
      created_at: msg.created_at || new Date().toISOString()
    };
  }

  /* ================================================================
     SEED
     ================================================================ */
  function seedIfEmpty() {
    try {
      const existing = DB.getAll('messages');
      if (!existing || existing.length === 0) {
        // Limpiar primero por si hay datos v1
        MESSAGES_SEED.forEach(msg => {
          try { DB.insert('messages', { ...msg }); } catch (e) { /* ignore dupes */ }
        });
      }
    } catch (err) {
      console.warn('[Messages] seedIfEmpty error:', err);
    }
  }

  /* ================================================================
     RENDER LEGACY: item de mensaje (compatibilidad API publica)
     ================================================================ */
  function renderMessageItem(msg) {
    return renderMailItem(migrateV1toV2(msg));
  }

  /* ================================================================
     BIND EVENTOS GLOBALES
     ================================================================ */
  function bindEvents() {
    // Boton "Marcar todos como leidos" si existe en la vista
    const $markAll = qs('#btn-mark-all-read');
    if ($markAll) {
      $markAll.addEventListener('click', markAllRead);
    }
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    try {
      injectMailboxCSS();

      $chips = qs('#msg-category-chips');
      $list  = qs('#messages-list');
      $badge = qs('#msg-badge');

      loadMessages();
      renderMailbox();
      bindEvents();
    } catch (err) {
      console.error('[Messages] init error:', err);
    }
  }

  /* ================================================================
     EXPOSE (API publica)
     ================================================================ */
  return {
    // Nuevas funciones v2
    renderMailbox,
    renderMessageList,
    renderMessageDetail,
    renderSummaryCard,
    toggleSelection,
    bulkApprove,
    bulkReject,
    formatDate,
    openMessage,
    backToList,
    approveMessage,
    rejectMessage,
    suggestAlternative,
    clearSelection,

    // Compatibilidad v1
    init,
    render,
    renderList: renderMailbox,
    renderMessageItem,
    renderChips,
    markRead,
    markAllRead,
    filterMessages,
    getCategoryColor,
    getCategoryIcon,
    updateBadge,
    seedIfEmpty,
    state
  };
})();