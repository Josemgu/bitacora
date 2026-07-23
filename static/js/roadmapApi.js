/**
 * ============================================================================
 * BITACORA - roadmapApi.js
 * API wrapper for roadmap endpoints (/api/roadmaps/*)
 * ============================================================================
 */

const RoadmapAPI = (function () {
  'use strict';

  const BASE_URL = '/api/roadmaps';
  const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const cache = {
    phases: null,
    topics: null,
    subtopics: null,
    projects: null,
    projectRequirements: null,
  };
  const cacheTimestamps = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`[RoadmapAPI] Error en ${config.method || 'GET'} ${url}:`, error);
      throw error;
    }
  }

  function get(endpoint) {
    return request(endpoint, { method: 'GET' });
  }

  function post(endpoint, data) {
    return request(endpoint, { method: 'POST', body: data });
  }

  function put(endpoint, data) {
    return request(endpoint, { method: 'PUT', body: data });
  }

  function patch(endpoint, data) {
    return request(endpoint, { method: 'PATCH', body: data });
  }

  function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

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
     ROADMAP
  ================================================================ */

  async function getRoadmap(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('roadmap');
      if (cached) return cached;
    }
    const data = await get('/');
    setCache('roadmap', data);
    return data;
  }

  async function createRoadmap(title) {
    const result = await post('/', { title });
    invalidateAllCache();
    return result;
  }

  async function updateRoadmap(roadmapId, data) {
    const result = await patch(`/${roadmapId}`, data);
    invalidateCache('roadmap');
    return result;
  }

  async function deleteRoadmap(roadmapId) {
    await del(`/${roadmapId}`);
    invalidateCache('roadmap');
  }

  /* ================================================================
     PHASES
  ================================================================ */

  async function getPhases(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = getCache('phases');
      if (cached) return cached;
    }
    const data = await get('/phases');
    setCache('phases', data);
    return data;
  }

  async function getPhase(id) {
    return get(`/phases/${id}`);
  }

  async function createPhase(data) {
    const result = await post('/phases', data);
    invalidateCache('phases');
    invalidateCache('roadmap');
    return result;
  }

  async function updatePhase(id, data) {
    const result = await patch(`/phases/${id}`, data);
    invalidateCache('phases');
    invalidateCache('roadmap');
    return result;
  }

  async function deletePhase(id) {
    await del(`/phases/${id}`);
    invalidateCache('phases');
    invalidateCache('roadmap');
  }

  async function reorderPhases(phaseOrders) {
    const result = await post('/phases/reorder', phaseOrders);
    invalidateCache('phases');
    invalidateCache('roadmap');
    return result;
  }

  async function getPhaseProgress(phaseId) {
    return get(`/phases/${phaseId}/progress`);
  }

  /* ================================================================
     TOPICS
  ================================================================ */

  async function getTopics(phaseId = null, forceRefresh = false) {
    const cacheKey = phaseId ? `topics_${phaseId}` : 'topics';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = phaseId ? `/phases/${phaseId}/topics` : '/topics';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getTopic(id) {
    return get(`/topics/${id}`);
  }

  async function createTopic(data) {
    const result = await post('/topics', data);
    invalidateCache('topics');
    if (data.phase_id) invalidateCache(`topics_${data.phase_id}`);
    invalidateCache('roadmap');
    return result;
  }

  async function updateTopic(id, data) {
    const result = await patch(`/topics/${id}`, data);
    invalidateCache('topics');
    const topic = await getTopic(id).catch(() => null);
    if (topic?.phase_id) invalidateCache(`topics_${topic.phase_id}`);
    invalidateCache('roadmap');
    return result;
  }

  async function deleteTopic(id) {
    await del(`/topics/${id}`);
    invalidateCache('topics');
    invalidateCache('roadmap');
  }

  async function reorderTopics(topicOrders) {
    const result = await post('/topics/reorder', topicOrders);
    invalidateCache('topics');
    invalidateCache('roadmap');
    return result;
  }

  async function bulkUpdateTopicStatus(topicIds, status) {
    const result = await post('/topics/bulk-status', { topic_ids: topicIds, status });
    invalidateCache('topics');
    invalidateCache('roadmap');
    return result;
  }

  /* ================================================================
     SUBTOPICS
  ================================================================ */

  async function getSubtopics(topicId = null, forceRefresh = false) {
    const cacheKey = topicId ? `subtopics_${topicId}` : 'subtopics';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = topicId ? `/topics/${topicId}/subtopics` : '/subtopics';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getSubtopic(id) {
    return get(`/subtopics/${id}`);
  }

  async function createSubtopic(data) {
    const result = await post('/subtopics', data);
    invalidateCache('subtopics');
    if (data.topic_id) invalidateCache(`subtopics_${data.topic_id}`);
    invalidateCache('roadmap');
    return result;
  }

  async function updateSubtopic(id, data) {
    const result = await patch(`/subtopics/${id}`, data);
    invalidateCache('subtopics');
    const subtopic = await getSubtopic(id).catch(() => null);
    if (subtopic?.topic_id) invalidateCache(`subtopics_${subtopic.topic_id}`);
    invalidateCache('roadmap');
    return result;
  }

  async function deleteSubtopic(id) {
    await del(`/subtopics/${id}`);
    invalidateCache('subtopics');
    invalidateCache('roadmap');
  }

  async function reorderSubtopics(subtopicOrders) {
    const result = await post('/subtopics/reorder', subtopicOrders);
    invalidateCache('subtopics');
    invalidateCache('roadmap');
    return result;
  }

  async function bulkUpdateSubtopicStatus(subtopicIds, done) {
    const result = await post('/subtopics/bulk-status', { subtopic_ids: subtopicIds, done });
    invalidateCache('subtopics');
    invalidateCache('roadmap');
    return result;
  }

  async function toggleSubtopic(id) {
    const subtopic = await getSubtopic(id);
    return updateSubtopic(id, { done: !subtopic.done });
  }

  /* ================================================================
     SUBTOPIC RESOURCES
  ================================================================ */

  async function getSubtopicResources(subtopicId) {
    return get(`/subtopics/${subtopicId}/resources`);
  }

  async function addSubtopicResource(subtopicId, data) {
    const result = await post(`/subtopics/${subtopicId}/resources`, data);
    invalidateCache('roadmap
    return result;
  }

  async function deleteSubtopicResource(resourceId) {
    await del(`/subtopic-resources/${resourceId}`);
  }

  /* ================================================================
     PROJECTS
  ================================================================ */

  async function getProjects(phaseId = null, forceRefresh = false) {
    const cacheKey = phaseId ? `projects_${phaseId}` : 'projects';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = phaseId ? `/phases/${phaseId}/projects` : '/projects';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function getProject(id) {
    return get(`/projects/${id}`);
  }

  async function createProject(data) {
    const result = await post('/projects', data);
    invalidateCache('projects');
    if (data.phase_id) invalidateCache(`projects_${data.phase_id}`);
    return result;
  }

  async function updateProject(id, data) {
    const result = await patch(`/projects/${id}`, data);
    invalidateCache('projects');
    return result;
  }

  async function deleteProject(id) {
    await del(`/projects/${id}`);
    invalidateCache('projects');
  }

  /* ================================================================
     PROJECT REQUIREMENTS (CHECKLIST)
  ================================================================ */

  async function getProjectRequirements(projectId = null, forceRefresh = false) {
    const cacheKey = projectId ? `projectRequirements_${projectId}` : 'projectRequirements';
    if (!forceRefresh) {
      const cached = getCache(cacheKey);
      if (cached) return cached;
    }
    const endpoint = projectId ? `/projects/${projectId}/requirements` : '/project-requirements';
    const data = await get(endpoint);
    setCache(cacheKey, data);
    return data;
  }

  async function createProjectRequirement(data) {
    const result = await post('/project-requirements', data);
    invalidateCache('projectRequirements');
    if (data.project_id) invalidateCache(`projectRequirements_${data.project_id}`);
    return result;
  }

  async function updateProjectRequirement(id, data) {
    const result = await patch(`/project-requirements/${id}`, data);
    invalidateCache('projectRequirements');
    return result;
  }

  async function deleteProjectRequirement(id) {
    await del(`/project-requirements/${id}`);
    invalidateCache('projectRequirements');
  }

  /* ================================================================
     ROADMAP.SH IMPORT
  ================================================================ */

  async function importRoadmapSh(data) {
    const result = await post('/sh/import', data);
    invalidateAllCache();
    return result;
  }

  async function getRoadmapShRoadmaps() {
    return get('/sh/roadmaps');
  }

  /* ================================================================
     AI RESOURCE SUGGESTIONS
  ================================================================ */

  async function suggestResources(data) {
    return post('/ai/suggest-resources', data);
  }

  /* ================================================================
     PUBLIC API
  ================================================================ */

  return {
    // Cache
    invalidateCache,
    invalidateAllCache,

    // Roadmap
    getRoadmap,
    createRoadmap,
    updateRoadmap,
    deleteRoadmap,

    // Phases
    getPhases,
    getPhase,
    createPhase,
    updatePhase,
    deletePhase,
    reorderPhases,
    getPhaseProgress,

    // Topics
    getTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    bulkUpdateTopicStatus,

    // Subtopics
    getSubtopics,
    getSubtopic,
    createSubtopic,
    updateSubtopic,
    deleteSubtopic,
    reorderSubtopics,
    bulkUpdateSubtopicStatus,
    toggleSubtopic,

    // Subtopic Resources
    getSubtopicResources,
    addSubtopicResource,
    deleteSubtopicResource,

    // Projects
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,

    // Project Requirements
    getProjectRequirements,
    createProjectRequirement,
    updateProjectRequirement,
    deleteProjectRequirement,

    // Import
    importRoadmapSh,
    getRoadmapShRoadmaps,

    // AI
    suggestResources,
  };
})();

// Export for global use (window.RoadmapAPI) and modules
if (typeof window !== 'undefined') {
  window.RoadmapAPI = RoadmapAPI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoadmapAPI;
}