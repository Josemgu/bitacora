/**
 * ============================================================================
 * Generate test data simulating a user with legacy localStorage key
 * 
 * HOW TO USE:
 * 1. Open index.html in browser
 * 2. Open DevTools → Console
 * 3. Paste the ENTIRE content of this file and press Enter
 * 4. The console will print a JSON object
 * 5. Copy that JSON, then run:
 *    localStorage.setItem('bitacora_encryption_key', <copied-json>)
 * 6. You now have a valid legacy key in localStorage
 * 
 * The script also prints a provider with api_key_encrypted that you
 * can manually add to localStorage.bitacora_ai_providers
 * ============================================================================
 */

(async function() {
  'use strict';

  // 1. Generate a 32-byte key
  var rawKey = new Uint8Array(32);
  crypto.getRandomValues(rawKey);
  
  // 2. Encode to base64
  var binary = '';
  for (var i = 0; i < rawKey.byteLength; i++) {
    binary += String.fromCharCode(rawKey[i]);
  }
  var base64Key = btoa(binary);
  
  // 3. Create the legacy key object (SAME format the old encryption.js used)
  var legacyKey = {
    key: base64Key,
    created: new Date().toISOString()
  };
  var legacyKeyJson = JSON.stringify(legacyKey);
  
  console.log('=== LEGACY KEY (copy this to localStorage.bitacora_encryption_key) ===');
  console.log(legacyKeyJson);
  console.log('');
  
  // 4. Import the key as Web Crypto key (extractable=true, like the old code did)
  var key = await crypto.subtle.importKey(
    'raw',
    rawKey.buffer,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 5. Encrypt a test API key (sk-test-key-12345)
  var plaintext = 'sk-test-key-12345';
  var encoder = new TextEncoder();
  var data = encoder.encode(plaintext);
  var iv = crypto.getRandomValues(new Uint8Array(12));
  
  var ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );
  
  // 6. Combine IV + ciphertext and encode to base64
  var combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  var binary2 = '';
  for (var j = 0; j < combined.byteLength; j++) {
    binary2 += String.fromCharCode(combined[j]);
  }
  var encryptedBase64 = btoa(binary2);
  
  // 7. Create the ai_providers array with at least one provider
  //    IMPORTANT: Use the EXACT format that config.js produces
  var existingProviders = [];
  try {
    var raw = localStorage.getItem('bitacora_ai_providers');
    if (raw) {
      existingProviders = JSON.parse(raw);
      console.log('Found existing providers: ' + existingProviders.length);
    }
  } catch(e) {}
  
  var testProvider = {
    id: existingProviders.length > 0 ? Math.max(...existingProviders.map(p => p.id || 0)) + 1 : 1,
    name: 'Test OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    default_model: 'gpt-4o-mini',
    env_key_name: '',
    active: true,
    is_active: true,
    mode: 'cloud',
    is_local: false,
    api_key_encrypted: encryptedBase64,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  console.log('=== TEST PROVIDER (paste into localStorage.bitacora_ai_providers) ===');
  console.log('If you already have providers, ADD this object to the existing array:');
  console.log(JSON.stringify(testProvider, null, 2));
  console.log('');
  console.log('=== QUICK SETUP (run both lines at once if bitacora_ai_providers is empty) ===');
  console.log('localStorage.setItem("bitacora_encryption_key", \'' + legacyKeyJson + '\');');
  console.log('localStorage.setItem("bitacora_ai_providers", \'[' + JSON.stringify(testProvider) + ']\');');
  console.log('');
  console.log('After running those two lines, reload the page to test migration.');
  console.log('');
  console.log('=== VERIFICATION (run after reload) ===');
  console.log('localStorage.getItem("bitacora_encryption_key");  // should be null');
  console.log('// Check IndexedDB: Application tab → IndexedDB → bitacora_keys → crypto_keys');
  console.log('');
  console.log('=== EXPORT TEST (run after reload to confirm extractable=false) ===');
  console.log(`
var dbReq = indexedDB.open('bitacora_keys', 1);
dbReq.onsuccess = async function() {
  var db = dbReq.result;
  var tx = db.transaction('crypto_keys', 'readonly');
  var store = tx.objectStore('crypto_keys');
  var getReq = store.get('encryption_v1');
  getReq.onsuccess = async function() {
    var key = getReq.result.key;
    try {
      var exported = await crypto.subtle.exportKey('raw', key);
      console.error('FAIL: Key IS extractable! Raw bytes:', new Uint8Array(exported));
    } catch(e) {
      console.log('PASS: exportKey threw ' + e.name + ' — key is NON-EXTRACTABLE');
    }
  };
};
  `.trim());
})();
