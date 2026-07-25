const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'static', 'js', 'provider-connection.js'), 'utf8');

function loadProviderConnection({ windowLocationOrigin = 'http://localhost:8000', sessionStore = {} } = {}) {
  const sandbox = {
    console,
    TextEncoder,
    URL,
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    crypto: globalThis.crypto || require('crypto').webcrypto,
    window: { location: { origin: windowLocationOrigin } },
    document: {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: {
      getItem(key) { return sessionStore[key] ?? null; },
      setItem(key, value) { sessionStore[key] = value; },
      removeItem(key) { delete sessionStore[key]; }
    },
    module: { exports: {} },
    exports: {}
  };
  sandbox.globalThis = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.module.exports || sandbox.ProviderConnection;
}

const ProviderConnection = loadProviderConnection();

test('generatePkceChallenge returns the RFC 7636 example challenge', async () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = await ProviderConnection.generatePkceChallenge(verifier);
  assert.equal(
    challenge,
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
  );
});

test('normalizeProviderOrigin keeps provider origin consistent for OpenRouter and Ollama', () => {
  assert.equal(
    ProviderConnection.normalizeProviderOrigin({ name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions' }),
    'openrouter'
  );
  assert.equal(
    ProviderConnection.normalizeProviderOrigin({ name: 'Ollama', endpoint: 'http://localhost:11434/api/chat' }),
    'ollama'
  );
});

test('guardForbiddenAuth rejects non-OpenRouter OAuth flows and allows the approved path', () => {
  assert.throws(
    () => ProviderConnection.guardForbiddenAuth({ name: 'Claude', endpoint: 'https://api.anthropic.com/v1/messages' }, { authMode: 'oauth', tokenUrl: 'https://api.anthropic.com/oauth/token' }),
    /Only OpenRouter/i
  );

  const result = ProviderConnection.guardForbiddenAuth(
    { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
    { authMode: 'oauth', tokenUrl: 'https://openrouter.ai/api/v1/oauth/token' }
  );

  assert.equal(result.ok, true);
  assert.equal(result.origin, 'openrouter');
});

test('finalizeOpenRouterFlow rejects callback payloads from unexpected origins', async () => {
  const sessionStore = {
    bitacora_openrouter_pkce: JSON.stringify({ verifier: 'abc123', redirectUri: 'http://localhost:8000/callback/openrouter.html' })
  };
  const ProviderConnectionWithOrigin = loadProviderConnection({ windowLocationOrigin: 'http://127.0.0.1:8000', sessionStore });

  await assert.rejects(
    () => ProviderConnectionWithOrigin.finalizeOpenRouterFlow('http://localhost:8000/callback/openrouter.html?code=test'),
    /origin/i
  );
});
