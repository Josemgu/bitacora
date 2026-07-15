const Tutorials = (() => {
  'use strict';

  const TUTORIALS_DATA = [
    { id: 1, title: 'Kubernetes Tutorial for Beginners', description: 'Curso completo de Kubernetes por TechWorld with Nana', url: 'https://www.youtube.com/@TechWorldwithNana', type: 'video', phase: 4 },
    { id: 2, title: 'AWS Certified Solutions Architect', description: 'Curso completo de AWS Solutions Architect por freeCodeCamp', url: 'https://www.youtube.com/watch?v=Ia-UEYYR44s', type: 'course', phase: 3 },
    { id: 3, title: 'Docker Complete Course', description: 'Curso completo de Docker en YouTube', url: 'https://www.youtube.com/results?search_query=docker+complete+course', type: 'course', phase: 4 },
    { id: 4, title: 'Linux for Hackers', description: 'Curso de Linux para hacking por NetworkChuck', url: 'https://www.youtube.com/@NetworkChuck', type: 'playlist', phase: 1 },
    { id: 5, title: 'Cloud Security Fundamentals', description: 'Fundamentos de seguridad en la nube por SANS', url: 'https://www.youtube.com/@SANSOfficial', type: 'video', phase: 3 },
    { id: 6, title: 'DefCon Conference 2024', description: 'Conferencia anual de seguridad informatica DefCon', url: 'https://www.youtube.com/@DEFCONConference', type: 'conference', phase: 5 },
    { id: 7, title: 'Terraform Tutorial', description: 'Tutorial oficial de Terraform por HashiCorp', url: 'https://developer.hashicorp.com/terraform/tutorials', type: 'official', phase: 3 },
    { id: 8, title: 'Introduction to Cyber Security', description: 'Introduccion a la ciberseguridad por Open University', url: 'https://www.youtube.com/results?search_query=introduction+to+cyber+security+open+university', type: 'course', phase: 2 },
    { id: 9, title: 'Wireshark Tutorial', description: 'Tutorial de Wireshark por Chris Greer', url: 'https://www.youtube.com/@ChrisGreer', type: 'video', phase: 1 },
    { id: 10, title: 'HackTheBox Starting Point', description: 'Punto de inicio de HackTheBox por IppSec', url: 'https://www.youtube.com/@ippsec', type: 'playlist', phase: 2 },
    { id: 11, title: 'Active Directory Attacks', description: 'Ataques a Active Directory por John Hammond', url: 'https://www.youtube.com/@_JohnHammond', type: 'video', phase: 2 },
    { id: 12, title: 'PicoCTF Walkthroughs', description: 'Soluciones de PicoCTF por LiveOverflow', url: 'https://www.youtube.com/@LiveOverflow', type: 'playlist', phase: 0 },
  ];

  const state = {
    type: 'all',
    search: '',
  };

  function init() {
    render();
    bindEvents();
  }

  function render() {
    const items = filterData();
    renderGrid(items);
  }

  function filterData() {
    let items = [...TUTORIALS_DATA];
    if (state.type !== 'all') {
      items = items.filter(t => t.type === state.type);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      items = items.filter(t => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return items;
  }

  function renderGrid(items) {
    const grid = document.getElementById('tutorials-grid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = `<div class="empty"><svg class="ico empty-ico"><use href="#i-info"></use></svg><p>No hay tutoriales para este filtro.</p></div>`;
      return;
    }
    grid.innerHTML = items.map(t => `
      <div class="res-card" data-id="${t.id}">
        <div class="res-top">
          <div class="res-logo">${getTypeIcon(t.type)}</div>
          <div style="flex:1;min-width:0">
            <strong style="font-size:13px">${t.title}</strong>
            <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">${t.description}</p>
          </div>
          <a href="${t.url}" target="_blank" rel="noopener" class="res-ext"><svg class="ico"><use href="#i-externo"></use></svg></a>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <span class="tag tag-blue">${getTypeLabel(t.type)}</span>
          <span class="tag">Fase ${t.phase}</span>
        </div>
      </div>
    `).join('');
  }

  function getTypeLabel(type) {
    const labels = { video: 'Video', course: 'Curso', playlist: 'Playlist', conference: 'Conferencia', official: 'Oficial' };
    return labels[type] || type;
  }

  function getTypeIcon(type) {
    const icons = { video: 'youtube', course: 'recursos', playlist: 'youtube', conference: 'info', official: 'docs' };
    const icon = icons[type] || 'recursos';
    return `<svg class="ico" style="width:20px;height:20px"><use href="#i-${icon}"></use></svg>`;
  }

  function bindEvents() {
    document.getElementById('tutorials-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
    });
    document.getElementById('tutorials-type-chips')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('#tutorials-type-chips .chip').forEach(c => c.classList.remove('is-on'));
      chip.classList.add('is-on');
      state.type = chip.dataset.type;
      render();
    });
  }

  return { init, render };
})();
