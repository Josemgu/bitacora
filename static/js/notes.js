const Notes = (() => {
  'use strict';

  var currentNoteId = null;
  var autoSaveTimer = null;

  function init() {
    seedIfEmpty();
    renderSidebar();
    bindEvents();
  }

  function seedIfEmpty() {
    var notes = DB.getAll('notes');
    if (notes.length === 0) {
      DB.insert('notes', {
        title: 'Apuntes de Cloud Security',
        content: '# Cloud Security\n\n## Conceptos clave\n\n- **Zero Trust**: Nunca confiar, siempre verificar\n- **Defense in Depth**: Capas de seguridad\n- **Least Privilege**: Minimo acceso necesario\n\n## Herramientas\n\n- Wazuh para SIEM\n- Suricata para IDS/IPS\n-pfSense para firewall',
        tags: 'cloud,security',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      DB.insert('notes', {
        title: 'Comandos Linux utiles',
        content: '# Comandos Linux\n\n## Redes\n```bash\nnetstat -tuln  # Puertos abiertos\nss -tuln       # Alternativa moderna\nnmap -sV IP    # Escaneo de servicios\n```\n\n## Seguridad\n```bash\nlastb          # Intentos de login fallidos\naureport --login --summary -i  # Reporte de auditoria\n```',
        tags: 'linux,comandos',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  function renderSidebar() {
    var list = document.getElementById('notes-sidebar-list');
    if (!list) return;
    var notes = DB.getAll('notes').sort(function(a, b) {
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    if (!notes.length) {
      list.innerHTML = '<div class="empty empty-sm"><p>Sin notas aun.</p><span class="empty-hint">Crea tu primera nota.</span></div>';
      return;
    }
    list.innerHTML = notes.map(function(n) {
      var isActive = n.id === currentNoteId;
      return `<div class="note-sidebar-item${isActive ? ' active' : ''}" data-id="${n.id}" style="padding:8px 12px;cursor:pointer;border-radius:6px;margin:2px 0;transition:background .15s;${isActive ? 'background:var(--nav-active)' : ''}">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.title || 'Sin titulo'}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${formatDate(n.updated_at)}</div>
      </div>`;
    }).join('');
    list.querySelectorAll('.note-sidebar-item').forEach(function(item) {
      item.addEventListener('click', function() {
        openNote(parseInt(item.dataset.id));
      });
    });
  }

  function openNote(id) {
    var note = DB.getById('notes', id);
    if (!note) return;
    currentNoteId = id;
    document.getElementById('notes-editor-panel').style.display = '';
    document.getElementById('notes-empty-panel').style.display = 'none';
    document.getElementById('note-title-input').value = note.title || '';
    document.getElementById('note-content-input').value = note.content || '';
    renderSidebar();
    startAutoSave();
  }

  function createNote() {
    var note = DB.insert('notes', {
      title: 'Nueva nota',
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    openNote(note.id);
  }

  function saveNote() {
    if (!currentNoteId) return;
    var title = document.getElementById('note-title-input').value.trim();
    var content = document.getElementById('note-content-input').value;
    DB.update('notes', currentNoteId, {
      title: title || 'Sin titulo',
      content: content,
      updated_at: new Date().toISOString()
    });
    renderSidebar();
  }

  function deleteNote() {
    if (!currentNoteId) return;
    if (!confirm('Eliminar esta nota?')) return;
    DB.delete('notes', currentNoteId);
    currentNoteId = null;
    document.getElementById('notes-editor-panel').style.display = 'none';
    document.getElementById('notes-empty-panel').style.display = '';
    renderSidebar();
  }

  function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(function() {
      if (currentNoteId) saveNote();
    }, 30000);
  }

  function bindEvents() {
    document.getElementById('btn-new-note')?.addEventListener('click', createNote);
    document.getElementById('btn-save-note')?.addEventListener('click', saveNote);
    document.getElementById('btn-delete-note')?.addEventListener('click', deleteNote);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'hace ' + diff + 's';
    if (diff < 3600) return 'hace ' + Math.floor(diff / 60) + 'm';
    if (diff < 86400) return 'hace ' + Math.floor(diff / 3600) + 'h';
    return d.toLocaleDateString();
  }

  return { init, renderSidebar, openNote, createNote, saveNote, deleteNote };
})();
