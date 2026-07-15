const Profile = (() => {
  'use strict';

  const STORAGE_KEY = 'bitacora_profile';

  const DEFAULTS = {
    first_name: 'Miguel',
    last_name: '',
    ai_language: 'es',
    experience_level: 'intermedio',
    weekly_hours: 15,
    timezone: 'America/Santo_Domingo',
    goal: 'Cloud Security Engineer en Canada',
  };

  let editing = false;

  function init() {
    render();
    bindEvents();
  }

  function getProfile() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
    return { ...DEFAULTS };
  }

  function saveProfile(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function render() {
    const profile = getProfile();
    const display = document.getElementById('profile-display');
    const form = document.getElementById('profile-form');
    if (!display || !form) return;

    if (editing) {
      display.style.display = 'none';
      form.style.display = '';
      document.getElementById('profile-first-name').value = profile.first_name || '';
      document.getElementById('profile-last-name').value = profile.last_name || '';
      document.getElementById('profile-goal').value = profile.goal || '';
      document.getElementById('profile-language').value = profile.ai_language;
      document.getElementById('profile-level').value = profile.experience_level;
      document.getElementById('profile-weekly-hours').value = profile.weekly_hours;
      document.getElementById('profile-timezone').value = profile.timezone;
    } else {
      display.style.display = '';
      form.style.display = 'none';
      const levelLabels = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };
      const langLabels = { es: 'Espanol', en: 'English' };
      display.innerHTML = `
        <div class="grid-2" style="margin-bottom:0">
          <div><strong>Nombre completo</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${profile.first_name || '-'} ${profile.last_name || ''}</p></div>
          <div><strong>Meta</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${profile.goal || '-'}</p></div>
        </div>
        <div class="grid-3" style="margin-bottom:0;margin-top:14px">
          <div><strong>Idioma IA</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${langLabels[profile.ai_language] || profile.ai_language}</p></div>
          <div><strong>Nivel</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${levelLabels[profile.experience_level] || profile.experience_level}</p></div>
          <div><strong>Horas/semana</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${profile.weekly_hours || '-'}</p></div>
        </div>
        <div style="margin-top:14px"><strong>Zona horaria</strong><p style="margin:4px 0 0;color:var(--text-secondary)">${profile.timezone}</p></div>
      `;
    }
  }

  function bindEvents() {
    document.getElementById('btn-edit-profile')?.addEventListener('click', () => { editing = true; render(); });
    document.getElementById('btn-cancel-profile')?.addEventListener('click', () => { editing = false; render(); });
    document.getElementById('btn-save-profile')?.addEventListener('click', () => {
      const data = {
        first_name: document.getElementById('profile-first-name').value.trim(),
        last_name: document.getElementById('profile-last-name').value.trim(),
        goal: document.getElementById('profile-goal').value.trim(),
        ai_language: document.getElementById('profile-language').value,
        experience_level: document.getElementById('profile-level').value,
        weekly_hours: parseInt(document.getElementById('profile-weekly-hours').value) || 15,
        timezone: document.getElementById('profile-timezone').value,
      };
      saveProfile(data);
      editing = false;
      render();
      if (typeof Health !== 'undefined' && Health.renderStatus) {
        Health.renderStatus();
      }
    });
  }

  function getFullName() {
    const p = getProfile();
    return `${p.first_name} ${p.last_name}`.trim() || 'Usuario';
  }

  return { init, render, getProfile, getFullName };
})();
