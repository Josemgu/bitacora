(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.ProviderConnection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const OPENROUTER_CLIENT_ID = 'bitacora-app';
  const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth/authorize';
  const OPENROUTER_TOKEN_URL = 'https://openrouter.ai/api/v1/auth/keys';
  const OPENROUTER_REDIRECT_URI = 'http://localhost:8000/callback/openrouter.html';

  function base64UrlEncode(bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    const binary = String.fromCharCode.apply(null, bytes);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function generatePkceChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    let digest;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      digest = crypto.subtle.digest('SHA-256', data);
    } else {
      throw new Error('Web Crypto is not available');
    }
    return digest.then((buffer) => base64UrlEncode(new Uint8Array(buffer)));
  }

  function normalizeProviderOrigin(provider) {
    const name = (provider && provider.name ? provider.name : '').toLowerCase();
    const endpoint = (provider && provider.endpoint ? provider.endpoint : '').toLowerCase();
    if (name.includes('openrouter') || endpoint.includes('openrouter')) return 'openrouter';
    if (name.includes('ollama') || endpoint.includes('localhost:11434') || endpoint.includes('ollama')) return 'ollama';
    if (name.includes('openai') || endpoint.includes('openai')) return 'openai';
    if (name.includes('anthropic') || endpoint.includes('anthropic')) return 'anthropic';
    if (name.includes('google') || endpoint.includes('google')) return 'google';
    return 'manual';
  }

  function guardForbiddenAuth(provider, options = {}) {
    const origin = normalizeProviderOrigin(provider);
    const authMode = (options && options.authMode) || 'manual';
    const tokenUrl = (options && options.tokenUrl) || '';

    if (authMode === 'oauth' && origin !== 'openrouter') {
      throw new Error('Only OpenRouter is allowed for OAuth-based provider connection in this app.');
    }

    if (authMode === 'oauth' && !tokenUrl.includes('openrouter')) {
      throw new Error('OAuth token exchange must target the official OpenRouter endpoint.');
    }

    return { ok: true, origin };
  }

  async function startOpenRouterFlow({ provider, redirectUri, stateKey = 'bitacora_openrouter_pkce' } = {}) {
    guardForbiddenAuth(provider, { authMode: 'oauth', tokenUrl: OPENROUTER_TOKEN_URL });

    const verifier = window.crypto.getRandomValues(new Uint8Array(32)).reduce((acc, value) => acc + value.toString(16).padStart(2, '0'), '');
    const challenge = await generatePkceChallenge(verifier);
    const redirect = redirectUri || OPENROUTER_REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: OPENROUTER_CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    sessionStorage.setItem(stateKey, JSON.stringify({ verifier, redirectUri: redirect }));
    window.location.href = `${OPENROUTER_AUTH_URL}?${params.toString()}`;
    return { ok: true, redirect, challenge };
  }

  async function finalizeOpenRouterFlow(callbackUrl, stateKey = 'bitacora_openrouter_pkce') {
    const url = new URL(callbackUrl, window.location.origin);
    const code = url.searchParams.get('code');
    const stored = sessionStorage.getItem(stateKey);
    if (!code || !stored) {
      throw new Error('Missing OpenRouter callback code or PKCE verifier.');
    }

    const expectedOrigin = new URL(window.location.origin);
    const callbackOrigin = new URL(url.origin);
    if (expectedOrigin.origin !== callbackOrigin.origin) {
      throw new Error('OpenRouter callback origin mismatch.');
    }

    const payload = JSON.parse(stored);
    const verifier = payload.verifier;
    return { ok: true, code, verifier, redirectUri: payload.redirectUri };
  }

  async function buildOpenRouterConnectionWarning(provider) {
    const origin = normalizeProviderOrigin(provider);
    if (origin !== 'openrouter') {
      return 'OpenRouter is only available through the official OpenRouter connection flow.';
    }
    return 'Aviso: el uso de OpenRouter puede generar gastos según el plan y el uso de tokens. Revisa el presupuesto antes de empezar.';
  }

  return {
    OPENROUTER_AUTH_URL,
    OPENROUTER_TOKEN_URL,
    OPENROUTER_REDIRECT_URI,
    generatePkceChallenge,
    normalizeProviderOrigin,
    guardForbiddenAuth,
    startOpenRouterFlow,
    finalizeOpenRouterFlow,
    buildOpenRouterConnectionWarning
  };
});
