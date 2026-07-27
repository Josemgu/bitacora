/**
 * import-roadmap.js — ImportRoadmap module for Bitacora App
 * Handles importing roadmaps from Markdown (.md) and JSON (.json) files.
 *
 * Flow: user selects file → preview shows "Archivo listo" → user clicks
 * "Importar" → POST /api/roadmaps/import → show result or error.
 *
 * The frontend no longer parses or stores anything locally.
 *
 * Uses global namespace: App
 * CSS classes used: .panel, .panel-head, .panel-body, .panel-note,
 *                   .btn, .btn-primary, .btn-ghost, .btn-sm, .btn-block,
 *                   .tag, .tag-green, .empty, .empty-ico, .empty-hint
 */
const ImportRoadmap = (() => {
  'use strict';

  /* ── DOM refs ────────────────────────────────────────────── */
  let $fileInput, $btnImportMD, $previewArea;

  /** The staged file waiting to be uploaded. null = nothing staged. */
  let _stagedFile = null;

  /* ── Init ────────────────────────────────────────────────── */
  function init() {
    $fileInput   = document.getElementById('import-md-file');
    $btnImportMD = document.getElementById('btn-import-md');
    $previewArea = document.getElementById('import-preview-area');

    if (!$fileInput || !$previewArea) return;

    _stagedFile = null;

    $fileInput.addEventListener('change', handleFileSelect);
    if ($btnImportMD) {
      // First click: if nothing staged, open file picker.
      // If a file is staged, upload it.
      $btnImportMD.addEventListener('click', handleButtonClick);
    }

    renderEmpty();
  }

  /* ── Empty state ─────────────────────────────────────────── */
  function renderEmpty() {
    $previewArea.innerHTML = `
      <div class="empty empty-sm">
        <div class="empty-ico">recursos</div>
        <div class="empty-hint">Selecciona un archivo .md o .json para importar</div>
      </div>
    `;
  }

  /* ── File input change → stage the file ──────────────────── */
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.md') && !name.endsWith('.markdown') && !name.endsWith('.json')) {
      _stagedFile = null;
      showError('Por favor selecciona un archivo .md, .markdown o .json');
      return;
    }

    _stagedFile = file;
    renderStaged(file.name);
  }

  /* ── "Importar" button → stage or upload ─────────────────── */
  function handleButtonClick() {
    if (_stagedFile) {
      doUpload(_stagedFile);
    } else {
      $fileInput.click();
    }
  }

  /* ── Render "file staged, ready to upload" ──────────────── */
  function renderStaged(filename) {
    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <span class="kicker">Listo para importar</span>
        </div>
        <div class="panel-body">
          <div style="font-size:var(--font-lg);font-weight:700;margin-bottom:8px;">
            Archivo listo: ${escapeHtml(filename)}
          </div>
          <div style="font-size:var(--font-sm);color:var(--text-dim);">
            Haz clic en <strong>Importar</strong> para cargar el roadmap.
          </div>
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════════════════════
     UPLOAD (POST /api/roadmaps/import)
     ════════════════════════════════════════════════════════════ */

  async function doUpload(file) {
    // Disable button + input during upload
    $btnImportMD.disabled = true;
    $fileInput.disabled = true;
    $previewArea.innerHTML = '<div class="empty empty-sm"><div class="empty-hint">Importando...</div></div>';

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/roadmaps/import', {
        method: 'POST',
        body: formData,
      });

      // 429: rate limit exceeded (5/minute)
      if (response.status === 429) {
        showError('Demasiados intentos. Espera un minuto antes de volver a importar.');
        // Keep the file staged so user can retry
        renderStaged(file.name);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        // 400: backend validation error (structure, field length, encoding)
        // 500: unexpected DB error (generic message)
        showError(data.detail || `Error ${response.status} al importar`);
        // Keep the file staged so user can retry
        renderStaged(file.name);
        return;
      }

      // SUCCESS — clear staged file and reset input
      _stagedFile = null;
      $fileInput.value = '';
      renderSuccess(data);
    } catch (err) {
      showError('Error de conexion: ' + err.message);
      // Keep the file staged so user can retry
      renderStaged(file.name);
    } finally {
      // Re-enable controls (button re-enabled; input stays as-is)
      $btnImportMD.disabled = false;
      $fileInput.disabled = false;
    }
  }

  /* ── Render success response from backend ───────────────── */
  function renderSuccess(data) {
    // data: { ok, career_id, career_title, phase_count, topic_count,
    //         subtopic_count, resource_count, warnings }

    let warningsHTML = '';
    if (data.warnings && data.warnings.length > 0) {
      warningsHTML = `
        <div class="panel-note" style="margin-top:8px;color:var(--text-dim);">
          <strong>Advertencias:</strong>
          <ul style="margin:4px 0 0 16px;font-size:var(--font-sm);">
            ${data.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>`;
    }
    $previewArea.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <span class="kicker">Importado</span>
          <span class="tag tag-green">${data.phase_count} fases · ${data.topic_count} topics · ${data.subtopic_count} subtopics</span>
        </div>
        <div class="panel-body">
          <div style="font-size:var(--font-lg);font-weight:700;margin-bottom:8px;">
            ${escapeHtml(data.career_title)}
          </div>
          <div style="font-size:var(--font-sm);color:var(--text-dim);margin-bottom:4px;">
            Recursos: ${data.resource_count}
          </div>
          ${warningsHTML}
        </div>
        <div class="panel-note" style="background:rgba(63,185,80,0.08);border-color:rgba(63,185,80,0.2);">
          <span class="mono">&#10003;</span> Roadmap importado. Activalo desde la lista de carreras para verlo.
        </div>
      </div>
    `;
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

  /* ── Public API ──────────────────────────────────────────── */
  return { init };
})();

