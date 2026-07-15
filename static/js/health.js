const Health = (() => {
  'use strict';

  var errorBuffer = [];
  var monitoringInterval = null;

  function init() {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    startMonitoring();
  }

  function onError(event) {
    captureError(event.message, event.filename, event.lineno, event.colno, event.error);
  }

  function onRejection(event) {
    var reason = event.reason;
    var msg = reason && reason.message ? reason.message : String(reason);
    captureError(msg, '', 0, 0, reason);
  }

  function captureError(message, source, lineno, colno, error) {
    var stack = error && error.stack ? error.stack : '';
    var hash = (message + stack).split('').reduce(function(a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    var existing = DB.query('health_events', function(e) {
      return e.hash === hash;
    });

    if (existing.length > 0) {
      var ev = existing[0];
      ev.count = (ev.count || 1) + 1;
      ev.last_seen = new Date().toISOString();
      DB.update('health_events', ev.id, ev);
    } else {
      DB.insert('health_events', {
        hash: hash,
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        stack: stack,
        count: 1,
        kind: 'js_error',
        resolved: false,
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString()
      });
    }

    renderStatus();
  }

  function checkAll() {
    return {
      db: 'ok',
      ai: 'warn',
      links: 'ok',
      queue: 'ok',
      jsErrors: errorBuffer.length > 0 ? 'warn' : 'ok'
    };
  }

  function renderStatus() {
    var items = document.querySelectorAll('.mod-state');
    var status = checkAll();
    var map = { db: 0, ai: 1, links: 2, queue: 3, jsErrors: 4 };
    for (var key in map) {
      var el = items[map[key]];
      if (!el) continue;
      el.className = 'mod-state ' + (status[key] === 'ok' ? 'ok' : 'warn');
      var txt = el.nextElementSibling || el;
      if (key === 'db') txt.textContent = 'Conexion activa';
      if (key === 'ai') txt.textContent = 'Sin proveedor configurado';
      if (key === 'links') txt.textContent = 'Pendiente';
      if (key === 'queue') {
        var pending = DB.query('resource_queue', function(q) { return q.status === 'pending'; }).length;
        txt.textContent = pending + ' pendientes';
      }
      if (key === 'jsErrors') {
        var unresolved = DB.query('health_events', function(e) { return !e.resolved; }).length;
        txt.textContent = unresolved === 0 ? 'Sin errores recientes' : unresolved + ' sin resolver';
      }
    }
  }

  function renderActivity() {
    var list = document.querySelector('.activity');
    if (!list) return;
    var events = DB.getAll('health_events').slice(-10).reverse();
    if (!events.length) {
      list.innerHTML = '<li>No hay eventos recientes</li>';
      return;
    }
    list.innerHTML = events.map(function(e) {
      return '<li><span>' + (e.message || 'Error') + '</span> <em>' + formatTime(e.created_at) + '</em></li>';
    }).join('');
  }

  function formatTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'hace ' + diff + 's';
    if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'm';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
    return 'hace ' + Math.floor(diff / 86400) + 'd';
  }

  function startMonitoring() {
    if (monitoringInterval) return;
    monitoringInterval = setInterval(renderStatus, 30000);
  }

  function stopMonitoring() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
  }

  return { init, renderStatus, renderActivity, startMonitoring, stopMonitoring };
})();
