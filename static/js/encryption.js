/**
 * ============================================================================
 * BITACORA - encryption.js
 * Client-side encryption using Web Crypto API (AES-GCM)
 * Used for encrypting API keys in hosted mode before sending to backend
 * ============================================================================
 */

const Encryption = (function () {
  'use strict';

  // Encryption key derived from user's master password or a stored key
  // In production, this should be derived from a user-provided master password
  // using PBKDF2. For now, we'll use a stored key or generate one.
  let encryptionKey = null;
  const KEY_STORAGE_KEY = 'bitacora_encryption_key';
  const KEY_DERIVATION_ITERATIONS = 100000;
  const KEY_LENGTH = 256; // bits
  const ALGORITHM = 'AES-GCM';
  const IV_LENGTH = 12; // 96 bits for GCM

  /**
   * Initialize encryption - get or generate encryption key
   */
  async function init() {
    // Try to get existing key from localStorage
    const storedKey = localStorage.getItem(KEY_STORAGE_KEY);
    if (storedKey) {
      try {
        const keyData = JSON.parse(storedKey);
        encryptionKey = await crypto.subtle.importKey(
          'raw',
          base64ToArrayBuffer(keyData.key),
          { name: ALGORITHM },
          false,
          ['encrypt', 'decrypt']
        );
        return true;
      } catch (e) {
        console.warn('Failed to load stored encryption key, generating new one:', e);
      }
    }

    // Generate new key
    return await generateKey();
  }

  /**
   * Generate a new encryption key and store it
   */
  async function generateKey() {
    try {
      const key = await crypto.subtle.generateKey(
        { name: ALGORITHM, length: KEY_LENGTH },
        true, // extractable
        ['encrypt', 'decrypt']
      );

      // Export and store the raw key
      const rawKey = await crypto.subtle.exportKey('raw', key);
      const keyData = {
        key: arrayBufferToBase64(rawKey),
        created: new Date().toISOString()
      };
      localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(keyData));

      encryptionKey = key;
      return true;
    } catch (e) {
      console.error('Failed to generate encryption key:', e);
      return false;
    }
  }

  /**
   * Derive key from user password (for future enhancement with master password)
   */
  async function deriveKeyFromPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: KEY_DERIVATION_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a plaintext string (API key) using AES-GCM
   * Returns base64 encoded string: iv:ciphertext:authTag
   */
  async function encrypt(plaintext) {
    if (!encryptionKey) {
      await init();
    }

    if (!encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Encrypt
      const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv: iv },
        encryptionKey,
        data
      );

      // Combine IV + ciphertext (auth tag is appended by Web Crypto)
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);

      return arrayBufferToBase64(combined.buffer);
    } catch (e) {
      console.error('Encryption failed:', e);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a base64 encoded string (iv:ciphertext:authTag)
   * Returns plaintext string
   */
  async function decrypt(encryptedData) {
    if (!encryptionKey) {
      await init();
    }

    if (!encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const combined = base64ToArrayBuffer(encryptedData);

      // Extract IV (first 12 bytes) and ciphertext
      const iv = combined.slice(0, IV_LENGTH);
      const ciphertext = combined.slice(IV_LENGTH);

      // Decrypt
      const plaintext = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: iv },
        encryptionKey,
        ciphertext
      );

      const decoder = new TextDecoder();
      return decoder.decode(plaintext);
    } catch (e) {
      console.error('Decryption failed:', e);
      throw new Error('Failed to decrypt data - wrong key or corrupted data');
    }
  }

  /**
   * Check if encryption is available (Web Crypto API support)
   */
  function isSupported() {
    return typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
  }

  /**
   * Get the current encryption key info (for display/debugging)
   */
  function getKeyInfo() {
    const stored = localStorage.getItem(KEY_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Clear stored encryption key (for testing or reset)
   */
  function clearKey() {
    localStorage.removeItem(KEY_STORAGE_KEY);
    encryptionKey = null;
  }

  // Utility functions
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Public API
  return {
    init,
    generateKey,
    encrypt,
    decrypt,
    isSupported,
    getKeyInfo,
    clearKey,
    deriveKeyFromPassword
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Encryption;
}