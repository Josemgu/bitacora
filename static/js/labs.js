const Labs = (() => {
  'use strict';

  const LABS_DATA = [
    { id: 1, title: 'Pre-Security Path', description: 'Fundamentos de ciberseguridad', platform: 'tryhackme', url: 'https://tryhackme.com/path/outline/presecurity', difficulty: 'beginner', is_free: true, phase: 1 },
    { id: 2, title: 'SOC Level 1', description: 'Simulacion de operaciones SOC', platform: 'tryhackme', url: 'https://tryhackme.com/path/outline/soclevel1', difficulty: 'intermediate', is_free: false, phase: 5 },
    { id: 3, title: 'Jr Penetration Tester', description: 'Pentesting basico', platform: 'tryhackme', url: 'https://tryhackme.com/path/outline/jrpenetrationtester', difficulty: 'intermediate', is_free: false, phase: 2 },
    { id: 4, title: 'Starting Point', description: 'Maquinas para principiantes', platform: 'hackthebox', url: 'https://app.hackthebox.com/starting-point', difficulty: 'beginner', is_free: true, phase: 2 },
    { id: 5, title: 'SOC Labs', description: 'Simulador de SOC con alertas reales', platform: 'letsdefend', url: 'https://letsdefend.io/', difficulty: 'intermediate', is_free: false, phase: 5 },
    { id: 6, title: 'Cloud Practitioner', description: 'Fundamentos de AWS cloud', platform: 'aws_skill_builder', url: 'https://skillbuilder.aws/', difficulty: 'beginner', is_free: true, phase: 3 },
    { id: 7, title: 'Azure Fundamentals', description: 'AZ-900 preparacion', platform: 'azure_learn', url: 'https://learn.microsoft.com/azure/', difficulty: 'beginner', is_free: true, phase: 3 },
    { id: 8, title: 'Cloud Skills Boost', description: 'Labs de Google Cloud', platform: 'google_cloud_skills', url: 'https://www.cloudskillsboost.google/', difficulty: 'beginner', is_free: false, phase: 3 },
    { id: 9, title: 'Kubernetes Labs', description: 'Practica Kubernetes en browser', platform: 'kodekloud', url: 'https://kodekloud.com/', difficulty: 'intermediate', is_free: false, phase: 4 },
    { id: 10, title: 'Web Security Academy', description: 'Vulnerabilidades web practicas', platform: 'portswigger', url: 'https://portswigger.net/web-security', difficulty: 'intermediate', is_free: true, phase: 2 },
    { id: 11, title: 'Bandit Wargame', description: 'Linux security via juego', platform: 'overthewire', url: 'https://overthewire.org/wargames/bandit/', difficulty: 'beginner', is_free: true, phase: 1 },
    { id: 12, title: 'PicoCTF', description: 'CTF para principiantes', platform: 'picoctf', url: 'https://picoctf.org/', difficulty: 'beginner', is_free: true, phase: 0 },
  ];

  const state = {
    platform: 'all',
    search: '',
  };

  function init() {
    render();
    bindEvents();
  }

  function render() {
    const items = filterLabs();
    renderGrid(items);
  }

  function filterLabs() {
    let items = [...LABS_DATA];
    if (state.platform !== 'all') {
      items = items.filter(l => l.platform === state.platform);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(l => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q));
    }
    return items;
  }

  function renderGrid(items) {
    const grid = document.getElementById('labs-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div class="empty"><svg class="ico empty-ico"><use href="#i-info"></use></svg><p>No hay laboratorios para este filtro.</p></div>`;
      return;
    }
    grid.innerHTML = items.map(l => `
      <div class="res-card" data-id="${l.id}">
        <div class="res-top">
          <div class="res-logo" style="background:${getPlatformColor(l.platform)}20;color:${getPlatformColor(l.platform)}">
            <svg class="ico" style="width:20px;height:20px"><use href="#i-sistema"></use></svg>
          </div>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${l.title}</strong>
            <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">${l.description}</p>
          </div>
          <a href="${l.url}" target="_blank" rel="noopener" class="res-ext"><svg class="ico"><use href="#i-externo"></use></svg></a>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <span class="tag" style="background:${getPlatformColor(l.platform)}20;color:${getPlatformColor(l.platform)}">${getPlatformLabel(l.platform)}</span>
          <span class="tag tag-${l.difficulty === 'beginner' ? 'green' : l.difficulty === 'intermediate' ? 'yellow' : 'red'}">${l.difficulty}</span>
          <span class="tag">${l.is_free ? 'Gratis' : 'Pago'}</span>
        </div>
      </div>
    `).join('');
  }

  function getPlatformColor(platform) {
    const colors = {
      tryhackme: '#ff5c5c', hackthebox: '#9fef00', letsdefend: '#00b4d8',
      aws_skill_builder: '#ff9900', azure_learn: '#0078d4', google_cloud_skills: '#4285f4',
      kodekloud: '#00d4aa', portswigger: '#ff6633', overthewire: '#b9b9b9', picoctf: '#5c5cff',
    };
    return colors[platform] || '#8b949e';
  }

  function getPlatformLabel(platform) {
    const labels = {
      tryhackme: 'TryHackMe', hackthebox: 'HackTheBox', letsdefend: 'LetsDefend',
      aws_skill_builder: 'AWS', azure_learn: 'Azure', google_cloud_skills: 'Google Cloud',
      kodekloud: 'KodeKloud', portswigger: 'PortSwigger', overthewire: 'OverTheWire', picoctf: 'PicoCTF',
    };
    return labels[platform] || platform;
  }

  function bindEvents() {
    document.getElementById('labs-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
    });
    document.getElementById('labs-platform-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#labs-platform-chips .chip').forEach(c => c.classList.remove('is-on'));
      chip.classList.add('is-on');
      state.platform = chip.dataset.platform;
      render();
    });
  }

  return { init, render };
})();
