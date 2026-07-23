/**
 * ============================================================================
 * BITACORA - api.js
 * Capa de servicio API — conecta el frontend con el backend FastAPI real.
 *
 * Rutas del backend:
 *   /api/roadmap/*   fases, temas, subtemas, proyectos, roadmap.sh, IA
 *   /api/resources   biblioteca de recursos + cola + descubrimiento web
 *   /api/providers   proveedores de IA
 *   /api/chat        historial + chat con el profesor IA
 *   /api/mailbox     buzón de notificaciones
 *   /api/profile     perfil de usuario
 *   /api/health      estado del sistema
 *
 * Lo que el backend no persiste todavía (horario, config visual, eventos
 * de salud locales) usa localStorage como respaldo para que la UI nunca
 * se rompa.
 * ============================================================================
 */

const API = (function () {
  'use strict';

  const BASE = '/api';
  const HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

  /* ================= HTTP ================= */

  async function request(path, options = {}) {
    const config = { headers: { ...HEADERS, ...options.headers }, ...options };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }
    const response = await fetch(BASE + path, config);
    if (!response.ok) {
      let detail;
      try { detail = (await response.json()).detail; } catch { detail = response.statusText; }
      const err = new Error(detail || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  const get = (p) => request(p, { method: 'GET' });
  const post = (p, d) => request(p, { method: 'POST', body: d });
  const put = (p, d) => request(p, { method: 'PUT', body: d });
  const patch = (p, d) => request(p, { method: 'PATCH', body: d });
  const del = (p) => request(p, { method: 'DELETE' });

  function qs(params) {
    const u = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.append(k, v);
    });
    const s = u.toString();
    return s ? `?${s}` : '';
  }

  /* ============ Aliases de compatibilidad ============ */
  // Algunos módulos antiguos usan .name donde el backend expone .title.

  function aliasTopic(t) {
    if (t && t.title !== undefined) t.name = t.title;
    return t;
  }

  function aliasPhase(p) {
    if (!p) return p;
    if (p.title !== undefined) p.name = p.title;
    if (Array.isArray(p.topics)) p.topics.forEach(aliasTopic);
    return p;
  }

  /* ================= ROADMAP ================= */

  async function getRoadmap() {
    return get('/roadmap/');
  }

  async function getPhases() {
    const phases = await get('/roadmap/phases');
    return (phases || []).map(aliasPhase);
  }

  const getPhase = (id) => get(`/roadmap/phases/${id}`).then(aliasPhase);
  const createPhase = (d) => post('/roadmap/phases', d);
  const updatePhase = (id, d) => patch(`/roadmap/phases/${id}`, d);
  const deletePhase = (id) => del(`/roadmap/phases/${id}`);
  const reorderPhases = (ids) => post('/roadmap/phases/reorder', ids);

  async function getTopics(phaseId) {
    const path = phaseId ? `/roadmap/phases/${phaseId}/topics` : '/roadmap/topics';
    const topics = await get(path);
    return (topics || []).map(aliasTopic);
  }

  const getTopic = (id) => get(`/roadmap/topics/${id}`).then(aliasTopic);
  const getTopicById = getTopic;
  const createTopic = (phaseId, d) => post(`/roadmap/phases/${phaseId}/topics`, d);
  const updateTopic = (id, d) => patch(`/roadmap/topics/${id}`, d);
  const deleteTopic = (id) => del(`/roadmap/topics/${id}`);
  const reorderTopics = (ids) => post('/roadmap/topics/reorder', ids);

  async function getSubtopics(topicId) {
    const path = topicId ? `/roadmap/topics/${topicId}/subtopics` : '/roadmap/subtopics';
    return get(path);
  }

  const getSubtopic = (id) => get(`/roadmap/subtopics/${id}`);
  const createSubtopic = (topicId, d) => post(`/roadmap/topics/${topicId}/subtopics`, d);
  const updateSubtopic = (id, d) => patch(`/roadmap/subtopics/${id}`, d);
  const deleteSubtopic = (id) => del(`/roadmap/subtopics/${id}`);
  const toggleSubtopic = (id) => post(`/roadmap/subtopics/${id}/toggle`);
  const reorderSubtopics = (ids) => post('/roadmap/subtopics/reorder', ids);

  /* ================= PROYECTOS ================= */

  async function getProjects(arg) {
    // Acepta getProjects(5) o getProjects({ phase_id: 5 }) o getProjects()
    let phaseId = null;
    if (typeof arg === 'number') phaseId = arg;
    else if (arg && typeof arg === 'object') phaseId = arg.phase_id ?? null;
    return get(`/roadmap/projects${qs({ phase_id: phaseId })}`);
  }

  const createProject = (phaseId, params) =>
    post(`/roadmap/phases/${phaseId}/projects${qs(params)}`);
  const updateProject = (id, params) => patch(`/roadmap/projects/${id}${qs(params)}`);
  const deleteProject = (id) => del(`/roadmap/projects/${id}`);

  async function getProjectRequirements(arg) {
    // Acepta getProjectRequirements({ project_id: 3 }) o (3)
    const projectId = typeof arg === 'number' ? arg : arg && arg.project_id;
    if (!projectId) return [];
    return get(`/roadmap/projects/${projectId}/checklist`);
  }

  const addChecklistItem = (projectId, label) =>
    post(`/roadmap/projects/${projectId}/checklist${qs({ label })}`);
  const updateChecklistItem = (id, params) => patch(`/roadmap/checklist-items/${id}${qs(params)}`);
  const deleteChecklistItem = (id) => del(`/roadmap/checklist-items/${id}`);

  /* ================= ROADMAP.SH + SYNC ================= */

  const getShRoadmaps = () => get('/roadmap/sh/roadmaps');
  const importShRoadmap = (d) => post('/roadmap/sh/import', d);
  const syncRoadmap = (roadmapId) => post(`/roadmap/sh/sync${qs({ roadmap_id: roadmapId })}`);
  const checkLinks = (limit) => post(`/roadmap/links/check${qs({ limit })}`);

  /* ================= IA (generación) ================= */

  const generateRoadmap = (careerPath, model) =>
    post('/roadmap/generate', { career_path: careerPath, model: model || null });
  const generateProject = (phaseId) => post(`/roadmap/phases/${phaseId}/generate-project`);
  const suggestResources = (d) => post('/roadmap/ai/suggest-resources', d);

  /* ================= RECURSOS ================= */

  async function getResources(filters) {
    return get(`/resources${qs(filters)}`);
  }

  const createResource = (d) => post('/resources', d);
  const deleteResource = (id) => del(`/resources/${id}`);
  const updateResourceLinkStatus = (id, status) =>
    patch(`/resources/${id}/link-status${qs({ status })}`);

  /* ============ Descubrimiento (búsqueda en internet) ============ */

  const discoverResources = (q, opts) =>
    post(`/resources/discover${qs({ q, ...(opts || {}) })}`);

  /* ================= COLA DE APROBACIÓN ================= */

  const getResourceQueue = () => get('/resources/queue');
  const approveResourceQueueItem = (id) => post(`/resources/queue/approve/${id}`);
  const rejectResourceQueueItem = (id) => post(`/resources/queue/reject/${id}`);
  const deleteResourceQueueItem = (id) => del(`/resources/queue/${id}`);

  /* ================= PROVEEDORES IA ================= */

  const getAIProviders = () => get('/providers');
  const createAIProvider = (d) => post('/providers', d);
  const deleteAIProvider = (id) => del(`/providers/${id}`);
  const setActiveAIProvider = (id) => patch(`/providers/${id}/activate`);

  /* ================= CHAT (profesor IA) ================= */

  const getMessages = () => get('/chat/messages');
  const createMessage = (d) => post('/chat/messages', d);
  const sendChatMessage = (content) =>
    post('/chat/chat', { role: 'user', content });
  const clearChatHistory = () => del('/chat/messages');

  /* ================= BUZÓN (mailbox) ================= */

  const getMailbox = (filters) => get(`/mailbox${qs(filters)}`);
  const createMailboxItem = (d) => post('/mailbox', d);
  const markMailboxRead = (id) => patch(`/mailbox/${id}/read`);
  const approveMailboxItem = (id) => patch(`/mailbox/${id}/approve`);
  const rejectMailboxItem = (id) => patch(`/mailbox/${id}/reject`);
  const dismissMailboxItem = (id) => patch(`/mailbox/${id}/dismiss`);
  const getMailboxUnread = () => get('/mailbox/stats/unread');

  /* ================= PERFIL ================= */

  const getProfile = () => get('/profile');
  const updateProfile = (d) => put('/profile', d);

  /* ================= HEALTH ================= */

  const healthCheck = () => get('/health');

  /* ============ Respaldo local (sin backend todavía) ============ */
  // Horario, config visual y eventos locales viven en localStorage para
  // que las vistas nunca fallen. Devuelven promesas para mantener la
  // misma interfaz async.

  function _localGet(key, fallback) {
    try {
      const raw = localStorage.getItem('bitacora_' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _localSet(key, value) {
    try { localStorage.setItem('bitacora_' + key, JSON.stringify(value)); } catch {}
    return value;
  }

  const getSchedule = async () => _localGet('schedule', []);
  const updateSchedule = async (d) => _localSet('schedule', d);
  const getConfig = async () => _localGet('config', {});
  const updateConfig = async (d) => _localSet('config', d);
  const getHealthEvents = async () => _localGet('health_events', []);
  const getLogEntries = async () => _localGet('log_entries', []);

  /* ================= EXPORT ================= */

  return {
    // núcleo http (para módulos que necesiten rutas nuevas)
    request, get, post, put, patch, del,

    // roadmap
    getRoadmap, getPhases, getPhase, createPhase, updatePhase, deletePhase, reorderPhases,
    getTopics, getTopic, getTopicById, createTopic, updateTopic, deleteTopic, reorderTopics,
    getSubtopics, getSubtopic, createSubtopic, updateSubtopic, deleteSubtopic,
    toggleSubtopic, reorderSubtopics,

    // proyectos
    getProjects, createProject, updateProject, deleteProject,
    getProjectRequirements, addChecklistItem, updateChecklistItem, deleteChecklistItem,

    // roadmap.sh + sync + notificaciones
    getShRoadmaps, importShRoadmap, syncRoadmap, checkLinks,

    // IA
    generateRoadmap, generateProject, suggestResources,

    // recursos + descubrimiento
    getResources, createResource, deleteResource, updateResourceLinkStatus,
    discoverResources,

    // cola
    getResourceQueue, approveResourceQueueItem, rejectResourceQueueItem, deleteResourceQueueItem,

    // proveedores IA
    getAIProviders, createAIProvider, deleteAIProvider, setActiveAIProvider,

    // chat
    getMessages, createMessage, sendChatMessage, clearChatHistory,

    // buzón
    getMailbox, createMailboxItem, markMailboxRead, approveMailboxItem,
    rejectMailboxItem, dismissMailboxItem, getMailboxUnread,

    // perfil / salud
    getProfile, updateProfile, healthCheck,

    // respaldo local
    getSchedule, updateSchedule, getConfig, updateConfig, getHealthEvents, getLogEntries
  };
})();

if (typeof window !== 'undefined') window.API = API;
