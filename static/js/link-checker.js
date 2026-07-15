const LinkChecker = (() => {
  'use strict';

  function init() {}

  async function verifyOne(resourceId) {
    const r = DB.getById('resources', resourceId);
    if (!r) return { status: 'unknown', httpCode: null };
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(r.url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeout);
      let status = 'unknown';
      let httpCode = null;
      if (response.ok) {
        status = 'ok';
        httpCode = response.status;
      } else if (response.status >= 300 && response.status < 400) {
        status = 'redirect';
        httpCode = response.status;
      } else if (response.status >= 400) {
        status = 'broken';
        httpCode = response.status;
      }
      DB.update('resources', resourceId, {
        link_status: status,
        link_http_code: httpCode,
        link_checked_at: new Date().toISOString()
      });
      return { status, httpCode };
    } catch (err) {
      DB.update('resources', resourceId, {
        link_status: 'unknown',
        link_checked_at: new Date().toISOString()
      });
      return { status: 'unknown', httpCode: null, error: err.message };
    }
  }

  async function verifyAll() {
    const resources = DB.getAll('resources').filter(r => r.status !== 'archived');
    const results = { ok: 0, broken: 0, redirect: 0, unknown: 0 };
    for (const r of resources) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const result = await verifyOne(r.id);
      results[result.status] = (results[result.status] || 0) + 1;
    }
    return results;
  }

  function canCheckUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      const hostname = u.hostname.toLowerCase();
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
      if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
      if (hostname.startsWith('172.')) {
        const second = parseInt(hostname.split('.')[1]);
        if (second >= 16 && second <= 31) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function getStatusColor(status) {
    const map = { ok: 'green', redirect: 'yellow', broken: 'red', unknown: 'gray' };
    return map[status] || 'gray';
  }

  return { init, verifyOne, verifyAll, canCheckUrl, getStatusColor };
})();
