const AIChat = (() => {
  'use strict';

  let initialized = false;
  let activeProvider = null;
  let apiKey = null;
  let messageHistory = [];

  function init() {
    if (initialized) return;
    initialized = true;
    loadProviders();
    loadHistory();
    bindEvents();
    renderQuickActions();
  }

  function loadProviders() {
    const providers = DB.getAll('ai_providers');
    const select = document.getElementById('chat-provider');
    if (!select) return;
    select.innerHTML = providers.map(p =>
      `<option value="${p.id}"${p.is_active ? ' selected' : ''}>${p.name}</option>`
    ).join('');
    const active = providers.find(p => p.is_active);
    if (active) activeProvider = active;
    select.addEventListener('change', () => {
      activeProvider = providers.find(p => p.id === parseInt(select.value));
    });
  }

  function bindEvents() {
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    const apiKeyInput = document.getElementById('chat-api-key');

    if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    if (apiKeyInput) {
      apiKeyInput.addEventListener('input', (e) => {
        apiKey = e.target.value.trim();
      });
    }
  }

  function buildSystemPrompt() {
    const phase = App.getCurrentPhase();
    const topic = App.getCurrentTopic();
    const profile = typeof Profile !== 'undefined' ? Profile.getProfile() : null;
    let prompt = 'Eres un mentor experto en tecnologia cloud y ciberseguridad.';
    prompt += ' Respondes en espanol de forma clara y concisa.';
    prompt += ' Das pasos concretos y relacionas con el homelab de Miguel.';
    if (phase) prompt += ` La fase actual es: ${phase.title}.`;
    if (topic) prompt += ` El tema en curso es: ${topic.title}.`;
    if (profile && profile.goal) prompt += ` La meta es: ${profile.goal}.`;
    return prompt;
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const log = document.getElementById('chat-log');
    if (!input || !log) return;
    const text = input.value.trim();
    if (!text) return;

    if (!apiKey) {
      alert('Introduce una clave API para el proveedor seleccionado');
      return;
    }

    renderMessage('user', text);
    messageHistory.push({ role: 'user', content: text });
    input.value = '';

    const typingEl = renderTyping();

    try {
      if (activeProvider && activeProvider.is_local) {
        await sendLocalMessage(text, typingEl);
      } else {
        await sendCloudMessage(text, typingEl);
      }
    } catch (err) {
      removeTyping(typingEl);
      renderMessage('system', 'Error: ' + err.message);
    }
  }

  async function sendLocalMessage(text, typingEl) {
    const response = await fetch(activeProvider.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeProvider.default_model || 'llama3.2',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...messageHistory.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: true
      })
    });
    await handleStream(response, typingEl);
  }

  async function sendCloudMessage(text, typingEl) {
    const headers = { 'Content-Type': 'application/json' };
    if (activeProvider.slug === 'anthropic') {
      headers['x-api-key'] = apiKey;
    } else {
      headers['Authorization'] = 'Bearer ' + apiKey;
    }
    const response = await fetch(activeProvider.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: activeProvider.default_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...messageHistory.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: true
      })
    });
    await handleStream(response, typingEl);
  }

  async function handleStream(response, typingEl) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    removeTyping(typingEl);
    const msgEl = renderMessage('assistant', '');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            content += delta;
            msgEl.textContent = content;
          } catch {}
        }
      }
    }
    messageHistory.push({ role: 'assistant', content });
    saveHistory();
  }

  function renderMessage(role, content) {
    const log = document.getElementById('chat-log');
    if (!log) return document.createElement('div');
    const div = document.createElement('div');
    div.style.cssText = role === 'user'
      ? 'background:var(--green-glow);padding:10px 14px;border-radius:10px;margin:6px 0;margin-left:20%;font-size:13px'
      : role === 'assistant'
        ? 'background:var(--card);padding:10px 14px;border-radius:10px;margin:6px 0;margin-right:20%;font-size:13px;border:1px solid var(--border)'
        : 'text-align:center;color:var(--text-faint);font-size:12px;margin:6px 0';
    div.textContent = content;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  function renderTyping() {
    const log = document.getElementById('chat-log');
    if (!log) return null;
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center;color:var(--text-faint);font-size:12px;margin:6px 0';
    div.textContent = 'Escribiendo...';
    log.appendChild(div);
    return div;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function renderQuickActions() {
    const container = document.querySelector('.chat-quick');
    if (!container) return;
    const actions = [
      'Explicame este tema',
      'Dame un ejercicio',
      'Resume lo aprendido',
      'Que estudiar hoy?'
    ];
    container.innerHTML = actions.map(a =>
      `<button class="btn btn-ghost btn-sm">${a}</button>`
    ).join('');
    container.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        if (input) {
          input.value = btn.textContent;
          sendMessage();
        }
      });
    });
  }

  function saveHistory() {
    localStorage.setItem('bitacora_chat_history', JSON.stringify(messageHistory.slice(-50)));
  }

  function loadHistory() {
    const saved = localStorage.getItem('bitacora_chat_history');
    if (saved) {
      try {
        messageHistory = JSON.parse(saved);
      } catch {}
    }
  }

  return { init, sendMessage, buildSystemPrompt };
})();
