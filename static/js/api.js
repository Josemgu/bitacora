/**
 * ============================================================================
 * BITACORA - api.js
 * Capa de servicio API genérica para comunicarse con el backend FastAPI.
 * Base URL: /api (cada módulo usa su prefijo de router correspondiente)
 * ============================================================================
 */

const API = (function () {
  'use strict';

  /* ================================================================
     CONFIGURACIÓN
  ================================================================ */
  const BASE_URL = '/api';
  const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  /* ================================================================
     ESTADO Y CACHE
  ================================================================ */
  const cache = {
    phases: null,
    topics: null,
    subtopics: null,
    resources: null,
    projects: null,
    projectRequirements: null,
    aiProviders: null,
    logEntries: null,
    healthEvents: null,
    resourceQueue: null,
    messages: null,
    notes: null,
    schedule: null,
    profile: null,
    config: null
  };

  const cacheTimestamps = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  /* ================================================================
     UTILIDADES HTTP
  ================================================================ */

  /**
   * Realiza una petición HTTP con manejo de errores.
   * @param {string} endpoint - Endpoint relativo (ej: '/phases')
   * @param {Object} options - Opciones fetch (method, body, headers)
   * @returns {Promise<any>} - Respuesta parseada como JSON
   */
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      ...options
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          errorData = { detail: response.statusText };
        }
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Para 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[API] Error en ${config.method || 'GET'} ${url}:`, error);
      throw error;
    }
  }

  /**
   * GET request
   */
  function get(endpoint) {
    return request(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  function post(endpoint, data) {
    return request(endpoint, { method: 'POST', body: data });
  }

  /**
   * PUT request
   */
  function put(endpoint, data) {
    return request(endpoint, { method: 'PUT', body: data });
  }

  /**
   * PATCH request
   */
  function patch(endpoint, data) {
    return request(endpoint, { method: 'PATCH', body: data });
  }

  /**
   * DELETE request
   */
  function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  /* ================================================================
     GESTIÓN DE CACHE
  ================================================================ */

  function isCacheValid(key) {
    const timestamp = cacheTimestamps[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_TTL;
  }

  function setCache(key, data) {
    cache[key] = data;
    cacheTimestamps[key] = Date.now();
  }

  function getCache(key) {
    if (isCacheValid(key)) {
      return cache[key];
    }
    return null;
  }

  function invalidateCache(key) {
    cache[key] = null;
    cacheTimestamps[key] = null;
  }

  function invalidateAllCache() {
    Object.keys(cache).forEach(key => invalidateCache(key));
  }

  /* ================================================================
     FASES (PHASES) - /api/roadmaps
  ================================================================ */

  async function getPhases(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('phases');
      if (cached) return cached;
    }
    const data = await get('/roadmaps/phases');
    setCache('phases', data);
    return data;
  }

  async function getPhase(id) {
    return get(`/roadmaps/phases/${id}`);
  }

  async function createPhase(data) {
    const result = await post('/roadmaps/phases', data);
    invalidateCache('phases');
    return result;
  }

  async function updatePhase(id, data) {
    const result = await put(`/roadmaps/phases/${id}`, data);
    invalidateCache('phases');
    return result;
  }

  async function deletePhase(id) {
    await del(`/roadmaps/phases/${id}`);
    invalidateCache('phases');
  }

  async function reorderPhases(phaseOrders) {
    const result = await post('/roadmaps/phases/reorder', phaseOrders);
    invalidateCache('phases');
    return result;
  }

  async function getPhaseProgress(phaseId) {
    return get(`/roadmaps/phases/${phaseId}/progress`);
  }

  /* ================================================================
     TEMAS (TOPICS) - /api/roadmaps
  ================================================================ */

  async function getTopics(phaseId = null, forceRefresh = false) {
    const cacheKey = phaseId ? `topics_${phaseId}` : 'topics';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = phaseId ? `/roadmaps/phases/${phaseId}/topics` : '/roadmaps/topics';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getTopic(id) {
    return get(`/roadmaps/topics/${id}`);
  }

  async function createTopic(data) {
    const result = await post('/roadmaps/topics', data);
    invalidateCache('topics');
    if (data.phase_id) invalidateCache(`topics_${data.phase_id}`);
    return result;
  }

  async function updateTopic(id, data) {
    const result = await put(`/roadmaps/topics/${id}`, data);
    invalidateCache('topics');
    // Invalidar cache por fase si se conoce
    const topic = await getTopic(id).catch(() => null);
    if (topic?.phase_id) invalidateCache(`topics_${topic.phase_id}`);
    return result;
  }

  async function deleteTopic(id) {
    await del(`/roadmaps/topics/${id}`);
    invalidateCache('topics');
  }

  async function reorderTopics(topicOrders) {
    const result = await post('/roadmaps/topics/reorder', topicOrders);
    invalidateCache('topics');
    return result;
  }

  async function bulkUpdateTopicStatus(topicIds, status) {
    const result = await post('/roadmaps/topics/bulk-status', { topic_ids: topicIds, status });
    invalidateCache('topics');
    return result;
  }

  /* ================================================================
     SUBTEMAS (SUBTOPICS) - /api/roadmaps
  ================================================================ */

  async function getSubtopics(topicId = null, forceRefresh = false) {
    const cacheKey = topicId ? `subtopics_${topicId}` : 'subtopics';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = topicId ? `/roadmaps/topics/${topicId}/subtopics` : '/roadmaps/subtopics';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getSubtopic(id) {
    return get(`/roadmaps/subtopics/${id}`);
  }

  async function createSubtopic(data) {
    const result = await post('/roadmaps/subtopics', data);
    invalidateCache('subtopics');
    if (data.topic_id) invalidateCache(`subtopics_${data.topic_id}`);
    return result;
  }

  async function updateSubtopic(id, data) {
    const result = await put(`/roadmaps/subtopics/${id}`, data);
    invalidateCache('subtopics');
    const subtopic = await getSubtopic(id).catch(() => null);
    if (subtopic?.topic_id) invalidateCache(`subtopics_${subtopic.topic_id}`);
    return result;
  }

  async function deleteSubtopic(id) {
    await del(`/roadmaps/subtopics/${id}`);
    invalidateCache('subtopics');
  }

  async function reorderSubtopics(subtopicOrders) {
    const result = await post('/roadmaps/subtopics/reorder', subtopicOrders);
    invalidateCache('subtopics');
    return result;
  }

  async function bulkUpdateSubtopicStatus(subtopicIds, done) {
    const result = await post('/roadmaps/subtopics/bulk-status', { subtopic_ids: subtopicIds, done });
    invalidateCache('subtopics');
    return result;
  }

  async function toggleSubtopic(id) {
    const result = await patch(`/roadmaps/subtopics/${id}/toggle`);
    invalidateCache('subtopics');
    return result;
  }

  /* ================================================================
     SUBTOPIC RESOURCES - /api/roadmaps
  ================================================================ */

  async function getSubtopicResources(subtopicId) {
    return get(`/roadmaps/subtopics/${subtopicId}/resources`);
  }

  async function addSubtopicResource(subtopicId, data) {
    const result = await post(`/roadmaps/subtopics/${subtopicId}/resources`, data);
    invalidateCache('subtopics');
    return result;
  }

  async function deleteSubtopicResource(resourceId) {
    await del(`/roadmaps/subtopic-resources/${resourceId}`);
    invalidateCache('subtopics');
  }

  /* ================================================================
     ROADMAP.SH IMPORT - /api/roadmaps
  ================================================================ */

  async function importRoadmapSh(data) {
    const result = await post('/roadmaps/sh/import', data);
    invalidateAllCache();
    return result;
  }

  async function getRoadmapShRoadmaps() {
    return get('/roadmaps/sh/roadmaps');
  }

  /* ================================================================
     AI RESOURCE SUGGESTIONS - /api/roadmaps
  ================================================================ */

  async function suggestResources(data) {
    return post('/roadmaps/ai/suggest-resources', data);
  }

  /* ================================================================
     RECURSOS (RESOURCES) - /api/resources
  ================================================================ */

  async function getResources(filters = {}, forceRefresh = false) {
    const cacheKey = `resources_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/resources${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getResource(id) {
    return get(`/resources/${id}`);
  }

  async function createResource(data) {
    const result = await post('/resources', data);
    invalidateCache('resources');
    return result;
  }

  async function updateResource(id, data) {
    const result = await put(`/resources/${id}`, data);
    invalidateCache('resources');
    return result;
  }

  async function deleteResource(id) {
    await del(`/resources/${id}`);
    invalidateCache('resources');
  }

  async function bulkUpdateResourceStatus(resourceIds, status) {
    const result = await post('/resources/bulk-status', { resource_ids: resourceIds, status });
    invalidateCache('resources');
    return result;
  }

  async function checkResourceLink(id) {
    return post(`/resources/${id}/check-link`);
  }

  async function bulkCheckResourceLinks(resourceIds) {
    return post('/resources/bulk-check-links', { resource_ids: resourceIds });
  }

  /* ================================================================
     PROYECTOS (PROJECTS) - /api/roadmaps
  ================================================================ */

  async function getProjects(phaseId = null, forceRefresh = false) {
    const cacheKey = phaseId ? `projects_${phaseId}` : 'projects';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = phaseId ? `/roadmaps/phases/${phaseId}/projects` : '/roadmaps/projects';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getProject(id) {
    return get(`/roadmaps/projects/${id}`);
  }

  async function createProject(data) {
    const result = await post('/roadmaps/projects', data);
    invalidateCache('projects');
    if (data.phase_id) invalidateCache(`projects_${data.phase_id}`);
    return result;
  }

  async function updateProject(id, data) {
    const result = await put(`/roadmaps/projects/${id}`, data);
    invalidateCache('projects');
    return result;
  }

  async function deleteProject(id) {
    await del(`/roadmaps/projects/${id}`);
    invalidateCache('projects');
  }

  /* ================================================================
     REQUISITOS DE PROYECTO (PROJECT REQUIREMENTS) - /api/roadmaps
  ================================================================ */

  async function getProjectRequirements(projectId = null, forceRefresh = false) {
    const cacheKey = projectId ? `projectRequirements_${projectId}` : 'projectRequirements';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = projectId ? `/roadmaps/projects/${projectId}/requirements` : '/roadmaps/project-requirements';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function createProjectRequirement(data) {
    const result = await post('/roadmaps/project-requirements', data);
    invalidateCache('projectRequirements');
    if (data.project_id) invalidateCache(`projectRequirements_${data.project_id}`);
    return result;
  }

  async function updateProjectRequirement(id, data) {
    const result = await put(`/roadmaps/project-requirements/${id}`, data);
    invalidateCache('projectRequirements');
    return result;
  }

  async function deleteProjectRequirement(id) {
    await del(`/roadmaps/project-requirements/${id}`);
    invalidateCache('projectRequirements');
  }

  /* ================================================================
     PROVEEDORES DE IA (AI PROVIDERS) - /api/providers
  ================================================================ */

  async function getAIProviders(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('aiProviders');
      if (cached) return cached;
    }
    const data = await get('/providers');
    setCache('aiProviders', data);
    return data;
  }

  async function getAIProvider(id) {
    return get(`/providers/${id}`);
  }

  async function createAIProvider(data) {
    const result = await post('/providers', data);
    invalidateCache('aiProviders');
    return result;
  }

  async function updateAIProvider(id, data) {
    const result = await put(`/providers/${id}`, data);
    invalidateCache('aiProviders');
    return result;
  }

  async function deleteAIProvider(id) {
    await del(`/providers/${id}`);
    invalidateCache('aiProviders');
  }

  async function setActiveAIProvider(id) {
    const result = await post(`/providers/${id}/activate`);
    invalidateCache('aiProviders');
    return result;
  }

  async function testAIProvider(id) {
    return post(`/providers/${id}/test`);
  }

  /* ================================================================
     ENTRADAS DE LOG (LOG ENTRIES) - /api
  ================================================================ */

  async function getLogEntries(filters = {}, forceRefresh = false) {
    const cacheKey = `logEntries_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/log-entries${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getLogEntry(id) {
    return get(`/log-entries/${id}`);
  }

  async function createLogEntry(data) {
    const result = await post('/log-entries', data);
    invalidateCache('logEntries');
    return result;
  }

  async function updateLogEntry(id, data) {
    const result = await put(`/log-entries/${id}`, data);
    invalidateCache('logEntries');
    return result;
  }

  async function deleteLogEntry(id) {
    await del(`/log-entries/${id}`);
    invalidateCache('logEntries');
  }

  /* ================================================================
     EVENTOS DE SALUD (HEALTH EVENTS) - /api
  ================================================================ */

  async function getHealthEvents(filters = {}, forceRefresh = false) {
    const cacheKey = `healthEvents_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/health-events${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getHealthEvent(id) {
    return get(`/health-events/${id}`);
  }

  async function createHealthEvent(data) {
    const result = await post('/health-events', data);
    invalidateCache('healthEvents');
    return result;
  }

  async function updateHealthEvent(id, data) {
    const result = await put(`/health-events/${id}`, data);
    invalidateCache('healthEvents');
    return result;
  }

  async function deleteHealthEvent(id) {
    await del(`/health-events/${id}`);
    invalidateCache('healthEvents');
  }

  async function getHealthStats() {
    return get('/health-events/stats/summary');
  }

  /* ================================================================
     COLA DE RECURSOS (RESOURCE QUEUE) - /api/mailbox
  ================================================================ */

  async function getResourceQueue(filters = {}, forceRefresh = false) {
    const cacheKey = `resourceQueue_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/mailbox/resource-queue${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getResourceQueueItem(id) {
    return get(`/mailbox/resource-queue/${id}`);
  }

  async function createResourceQueueItem(data) {
    const result = await post('/mailbox/resource-queue', data);
    invalidateCache('resourceQueue');
    return result;
  }

  async function updateResourceQueueItem(id, data) {
    const result = await put(`/mailbox/resource-queue/${id}`, data);
    invalidateCache('resourceQueue');
    return result;
  }

  async function deleteResourceQueueItem(id) {
    await del(`/mailbox/resource-queue/${id}`);
    invalidateCache('resourceQueue');
  }

  async function approveResourceQueueItem(id) {
    const result = await post(`/mailbox/resource-queue/${id}/approve`);
    invalidateCache('resourceQueue');
    return result;
  }

  async function rejectResourceQueueItem(id, reason) {
    const result = await post(`/mailbox/resource-queue/${id}/reject`, { reason });
    invalidateCache('resourceQueue');
    return result;
  }

  /* ================================================================
     MENSAJES (MESSAGES) - Chat IA - /api/chat
  ================================================================ */

  async function getMessages(filters = {}, forceRefresh = false) {
    const cacheKey = `messages_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/chat/messages${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getMessage(id) {
    return get(`/chat/messages/${id}`);
  }

  async function createMessage(data) {
    const result = await post('/chat/messages', data);
    invalidateCache('messages');
    return result;
  }

  async function updateMessage(id, data) {
    const result = await put(`/chat/messages/${id}`, data);
    invalidateCache('messages');
    return result;
  }

  async function deleteMessage(id) {
    await del(`/chat/messages/${id}`);
    invalidateCache('messages');
  }

  async function sendChatMessage(data) {
    return post('/chat/messages/chat', data);
  }

  /* ================================================================
     NOTAS (NOTES) - /api/profile
  ================================================================ */

  async function getNotes(filters = {}, forceRefresh = false) {
    const cacheKey = `notes_${JSON.stringify(filters)}`;
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const endpoint = `/profile/notes${params.toString() ? `?${params.toString()}` : ''}`;
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getNote(id) {
    return get(`/profile/notes/${id}`);
  }

  async function createNote(data) {
    const result = await post('/profile/notes', data);
    invalidateCache('notes');
    return result;
  }

  async function updateNote(id, data) {
    const result = await put(`/profile/notes/${id}`, data);
    invalidateCache('notes');
    return result;
  }

  async function deleteNote(id) {
    await del(`/profile/notes/${id}`);
    invalidateCache('notes');
  }

  /* ================================================================
     HORARIO (SCHEDULE) - /api/profile
  ================================================================ */

  async function getSchedule(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('schedule');
      if (cached) return cached;
    }
    const data = await get('/profile/schedule');
    setCache('schedule', data);
    return data;
  }

  async function createScheduleItem(data) {
    const result = await post('/profile/schedule', data);
    invalidateCache('schedule');
    return result;
  }

  async function updateScheduleItem(id, data) {
    const result = await put(`/profile/schedule/${id}`, data);
    invalidateCache('schedule');
    return result;
  }

  async function deleteScheduleItem(id) {
    await del(`/profile/schedule/${id}`);
    invalidateCache('schedule');
  }

  /* ================================================================
     PERFIL Y CONFIGURACIÓN - /api/profile
  ================================================================ */

  async function getProfile(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('profile');
      if (cached) return cached;
    }
    const data = await get('/profile');
    setCache('profile', data);
    return data;
  }

  async function updateProfile(data) {
    const result = await put('/profile', data);
    invalidateCache('profile');
    return result;
  }

  async function getConfig(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('config');
      if (cached) return cached;
    }
    const data = await get('/profile/config');
    setCache('config', data);
    return data;
  }

  async function updateConfig(data) {
    const result = await put('/profile/config', data);
    invalidateCache('config');
    return result;
  }

  /* ================================================================
     IMPORTAR / GENERAR ROADMAP - /api/roadmaps
  ================================================================ */

  async function importRoadmap(data) {
    const result = await post('/roadmaps/import', data);
    invalidateAllCache();
    return result;
  }

  async function generateRoadmap(data) {
    return post('/roadmaps/generate', data);
  }

  /* ================================================================
     HEALTH CHECK - /api
  ================================================================ */

  async function healthCheck() {
    return get('/health');
  }

  /* ================================================================
     API PÚBLICA
  ================================================================ */

  return {
    // Cache
    invalidateCache,
    invalidateAllCache,

    // Fases
    getPhases,
    getPhase,
    createPhase,
    updatePhase,
    deletePhase,
    reorderPhases,
    getPhaseProgress,

    // Temas
    getTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    bulkUpdateTopicStatus,

    // Subtemas
    getSubtopics,
    getSubtopic,
    createSubtopic,
    updateSubtopic,
    deleteSubtopic,
    reorderSubtopics,
    bulkUpdateSubtopicStatus,

    // Subtopic Resources
    getSubtopicResources,
    addSubtopicResource,
    deleteSubtopicResource,

    // Recursos
    getResources,
    getResource,
    createResource,
    updateResource,
    deleteResource,
    bulkUpdateResourceStatus,
    checkResourceLink,
    bulkCheckResourceLinks,

    // Proyectos
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,

    // Requisitos de proyecto
    getProjectRequirements,
    createProjectRequirement,
    updateProjectRequirement,
    deleteProjectRequirement,

    // Proveedores IA
    getAIProviders,
    getAIProvider,
    createAIProvider,
    updateAIProvider,
    deleteAIProvider,
    setActiveAIProvider,
    testAIProvider,

    // Log entries
    getLogEntries,
    getLogEntry,
    createLogEntry,
    updateLogEntry,
    deleteLogEntry,

    // Health events
    getHealthEvents,
    getHealthEvent,
    createHealthEvent,
    updateHealthEvent,
    deleteHealthEvent,
    getHealthStats,

    // Resource queue
    getResourceQueue,
    getResourceQueueItem,
    createResourceQueueItem,
    updateResourceQueueItem,
    deleteResourceQueueItem,
    approveResourceQueueItem,
    rejectResourceQueueItem,

    // Mensajes (Chat)
    getMessages,
    getMessage,
    createMessage,
    updateMessage,
    deleteMessage,
    sendChatMessage,

    // Notas
    getNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,

    // Horario
    getSchedule,
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,

    // Perfil y Config
    getProfile,
    updateProfile,
    getConfig,
    updateConfig,

    // Import/Generate
    importRoadmap,
    generateRoadmap,
    getRoadmapShRoadmaps,
    suggestResources,

    // Health
    healthCheck
  };
})();

// Exportar para uso global (window.API) y módulos
if (typeof window !== 'undefined') {
  window.API = API;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}