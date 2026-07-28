/**
 * ============================================================================
 * BITACORA - encryption.js
 * Client-side encryption using Web Crypto API (AES-GCM)
 * 
 * SECURITY MODEL (A1, verified 2026-07-27):
 * - AES-GCM key is generated with extractable=false → the key material is
 *   NEVER readable from JavaScript (exportKey throws InvalidAccessError).
 * - The non-extractable CryptoKey is stored in IndexedDB (structured clone),
 *   NOT in localStorage (strings only).
 * - Even with XSS, an attacker CAN use the key to encrypt/decrypt while the
 *   tab is open, but CANNOT export, exfiltrate, or persist it.
 * - The encryption key itself is NOT bound to the browser profile — copying
 *   IndexedDB files to another machine still works. Protects against XSS,
 *   NOT against physical disk access.
 *
 * Migration:
 * - On first load, if a legacy key exists in localStorage (bitacora_encryption_key),
 *   it decrypts all existing providers with the old key, re-encrypts with the
 *   new non-extractable key, stores the new key in IndexedDB, VERIFIES the new
 *   key works by decrypting one provider, and only then persists the re-encrypted
 *   providers and deletes the old key. If any step fails, nothing is deleted.
 *
 * CSP REQUIREMENT (second layer, see main.py):
 *   default-src 'self'; script-src 'self'; object-src 'none';
 *   base-uri 'self'; frame-ancestors 'none'
 * ============================================================================
 */
(function () {
  'use strict';

  /* ─── Configuration ─── */
  var ALGORITHM = 'AES-GCM';
  var KEY_LENGTH = 256;             // bits
  var IV_LENGTH = 12;               // bytes (96 bits for GCM)
  var DB_NAME = 'bitacora_keys';
  var STORE_NAME = 'crypto_keys';
  var KEY_RECORD_NAME = 'encryption_v1';  // allows future key rotation (v2, etc.)
  var LEGACY_KEY_STORAGE = 'bitacora_encryption_key';

  /* ─── State ─── */
  var encryptionKey = null;            // CryptoKey object (extractable=false)

  /* ═══════════════════════════════════════════════════════════════════
     IndexedDB helpers
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Open IndexedDB and create object store if needed.
   * @param {number} [version=1]
   * @returns {Promise<IDBDatabase>}
   */
  function _openDB(version) {
    version = version || 1;
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, version);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'name' });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(new Error('IndexedDB no disponible. ' +
          'Bitacora necesita IndexedDB para guardar claves de forma segura. ' +
          'Abre la app en un navegador con IndexedDB habilitado.'));
      };
    });
  }

  /**
   * Load the CryptoKey from IndexedDB.
   * @returns {Promise<CryptoKey|null>}
   */
  function _loadKeyFromDB() {
    return _openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(KEY_RECORD_NAME);

        req.onsuccess = function () {
          var record = req.result;
          if (record && record.key instanceof CryptoKey) {
            resolve(record.key);
          } else {
            resolve(null);
          }
        };

        req.onerror = function () {
          reject(new Error('Error al leer la clave de cifrado'));
        };

        tx.oncomplete = function () {
          db.close();
        };
      });
    });
  }

  /**
   * Save a CryptoKey to IndexedDB.
   * @param {CryptoKey} key
   * @returns {Promise<void>}
   */
  function _saveKeyToDB(key) {
    return _openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var record = {
          name: KEY_RECORD_NAME,
          key: key,
          created: new Date().toISOString()
        };

        var req = store.put(record);

        req.onsuccess = function () {
          resolve();
        };

        req.onerror = function () {
          reject(new Error('Error al guardar la clave de cifrado en IndexedDB'));
        };

        tx.oncomplete = function () {
          db.close();
        };
      });
    });
  }

  /**
   * Delete the encryption key record from IndexedDB.
   * @returns {Promise<void>}
   */
  function _deleteKeyFromDB() {
    return _openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.delete(KEY_RECORD_NAME);

        req.onsuccess = function () {
          resolve();
        };

        req.onerror = function () {
          reject(new Error('Error al eliminar la clave de cifrado'));
        };

        tx.oncomplete = function () {
          db.close();
        };
      });
    });
  }

  /**
   * Delete the legacy encryption key from localStorage (if any).
   */
  function _deleteLegacyKey() {
    try {
      localStorage.removeItem(LEGACY_KEY_STORAGE);
    } catch (e) {
      // Ignore — localStorage may not be available
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     Key generation
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Generate a new AES-GCM key as non-extractable CryptoKey.
   * The key material can NEVER be exported or read from JavaScript.
   * @returns {Promise<CryptoKey>}
   */
  function _generateCryptoKey() {
    return crypto.subtle.generateKey(
      { name: ALGORITHM, length: KEY_LENGTH },
      false,  // extractable = false — security critical
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a new encryption key, store it in IndexedDB, and set it as active.
   * @returns {Promise<boolean>}
   */
  function _generateAndStoreKey() {
    return _generateCryptoKey().then(function (key) {
      encryptionKey = key;
      return _saveKeyToDB(key).then(function () {
        return true;
      });
    }).catch(function (e) {
      encryptionKey = null;
      throw e;
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Low-level encrypt/decrypt with explicit key (for migration)
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Decrypt with a specific key (used during migration).
   * @param {string} encryptedBase64
   * @param {CryptoKey} key
   * @returns {Promise<string>}
   */
  function _decryptWithKey(encryptedBase64, key) {
    var combined = _base64ToArrayBuffer(encryptedBase64);
    var iv = combined.slice(0, IV_LENGTH);
    var ciphertext = combined.slice(IV_LENGTH);

    return crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      key,
      ciphertext
    ).then(function (plaintext) {
      return new TextDecoder().decode(plaintext);
    });
  }

  /**
   * Encrypt with a specific key (used during migration).
   * @param {string} plaintext
   * @param {CryptoKey} key
   * @returns {Promise<string>}
   */
  function _encryptWithKey(plaintext, key) {
    var data = new TextEncoder().encode(plaintext);
    var iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    return crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      key,
      data
    ).then(function (ciphertext) {
      var combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return _arrayBufferToBase64(combined.buffer);
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Migration from legacy localStorage key
     ═══════════════════════════════════════════════════════════════════ */

  /**
   * Migrate from old localStorage-based key to new non-extractable IndexedDB key.
   * Order (critical): generate key → re-encrypt in memory → persist key →
   * verify key works → persist re-encrypted providers → delete old key.
   * If any step fails before verification pass, nothing is touched.
   *
   * @param {string} oldKeyJson - JSON string from localStorage
   * @returns {Promise<boolean>}
   */
  function _migrateFromLocalStorage(oldKeyJson) {
    var oldKeyData;
    try {
      oldKeyData = JSON.parse(oldKeyJson);
    } catch (e) {
      return Promise.reject(
        new Error('Clave de cifrado antigua corrupta. Reconfigura tus proveedores.')
      );
    }

    var oldKey;
    var providers;
    var newKey;
    var reEncrypted;

    // Step 0: Parse old key data
    return Promise.resolve().then(function () {
      // Import old key as EXTRACTABLE (necessary to decrypt what it encrypted)
      return crypto.subtle.importKey(
        'raw',
        _base64ToArrayBuffer(oldKeyData.key),
        { name: ALGORITHM },
        true,  // extractable = true (temporary, only during migration)
        ['encrypt', 'decrypt']
      );
    }).then(function (importedKey) {
      oldKey = importedKey;

      // Read existing providers from localStorage
      var raw;
      try {
        raw = localStorage.getItem('bitacora_ai_providers');
        providers = raw ? JSON.parse(raw) : [];
      } catch (e) {
        throw new Error('No se pudieron leer los proveedores existentes.');
      }

      // Generate new non-extractable key (extractable=false)
      return _generateCryptoKey();
    }).then(function (generatedKey) {
      newKey = generatedKey;

      // Re-encrypt each provider that has an encrypted key — IN MEMORY ONLY
      reEncrypted = [];
      var chain = Promise.resolve();
      for (var i = 0; i < providers.length; i++) {
        (function (idx) {
          chain = chain.then(function () {
            var p = {};
            // Shallow copy
            for (var k in providers[idx]) {
              if (providers[idx].hasOwnProperty(k)) {
                p[k] = providers[idx][k];
              }
            }
            if (p.api_key_encrypted) {
              return _decryptWithKey(p.api_key_encrypted, oldKey).then(function (decrypted) {
                return _encryptWithKey(decrypted, newKey);
              }).then(function (reEncryptedKey) {
                p.api_key_encrypted = reEncryptedKey;
                reEncrypted.push(p);
              });
            } else {
              reEncrypted.push(p);
              return Promise.resolve();
            }
          });
        })(i);
      }
      return chain;
    }).then(function () {
      // Step 1: Persist the NEW key FIRST (before touching anything else)
      return _saveKeyToDB(newKey);
    }).then(function () {
      // Step 2: VERIFY — re-read key from IndexedDB and decrypt one provider
      return _loadKeyFromDB();
    }).then(function (verifiedKey) {
      if (!verifiedKey) {
        throw new Error('La clave recien guardada no se encuentra en IndexedDB.');
      }

      // Verify by decrypting first re-encrypted provider
      var firstEncrypted = null;
      var firstOriginalPlain = null;
      var firstReEncrypted = null;

      // Find first provider that had encrypted key
      for (var j = 0; j < providers.length; j++) {
        if (providers[j].api_key_encrypted) {
          firstEncrypted = providers[j].api_key_encrypted;
          firstReEncrypted = reEncrypted[j].api_key_encrypted;
          break;
        }
      }

      if (firstEncrypted) {
        // Decrypt original with old key to get plaintext
        return _decryptWithKey(firstEncrypted, oldKey).then(function (originalPlain) {
          firstOriginalPlain = originalPlain;
          // Decrypt re-encrypted with new (verified) key
          return _decryptWithKey(firstReEncrypted, verifiedKey);
        }).then(function (testDecrypted) {
          if (testDecrypted !== firstOriginalPlain) {
            throw new Error('Verification mismatch');
          }
          encryptionKey = verifiedKey;
          // Step 3: Verification passed — persist re-encrypted providers
          try {
            localStorage.setItem('bitacora_ai_providers', JSON.stringify(reEncrypted));
          } catch (e) {
            throw new Error('No se pudieron guardar los proveedores migrados.');
          }
          // Step 4: Delete old key
          _deleteLegacyKey();
          console.info('[Encryption] Migracion completada: clave movida de localStorage a IndexedDB');
          return true;
        });
      } else {
        // No providers with encrypted keys — just store the new key and clean up
        encryptionKey = verifiedKey;
        _deleteLegacyKey();
        console.info('[Encryption] Migracion completada: no habia proveedores que migrar');
        return true;
      }
    }).catch(function (e) {
      // Anything failed — rollback: delete the new key from IndexedDB
      if (newKey) {
        _deleteKeyFromDB().catch(function () {/* best effort */});
      }
      encryptionKey = null;
      throw e;
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Public API: Encryption module
     ═══════════════════════════════════════════════════════════════════ */

  var Encryption = {};

  /**
   * Initialize the encryption module.
   * Tries to load the key from IndexedDB first.
   * Falls back to migrating from localStorage if old key exists.
   * Does NOT generate a new key automatically (see encrypt()).
   *
   * @returns {Promise<boolean>} true if encryption is ready
   * @throws {Error} if IndexedDB is unavailable
   */
  Encryption.init = function () {
    // Try to load existing key from IndexedDB
    return _loadKeyFromDB().then(function (storedKey) {
      if (storedKey) {
        encryptionKey = storedKey;
        return true;
      }

      // No key in IndexedDB — check for legacy key in localStorage
      var legacyKey;
      try {
        legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE);
      } catch (e) {
        legacyKey = null;
      }

      if (legacyKey) {
        // Migrate from old localStorage key
        return _migrateFromLocalStorage(legacyKey);
      }

      // No key anywhere — but we DON'T generate one here.
      // encrypt() will call init() and generate if needed.
      // decrypt() will throw a clear error.
      encryptionKey = null;
      return true;  // module is ready, just no key yet
    });
  };

  /**
   * Encrypt a plaintext API key string.
   * If no encryption key exists, generates one lazily.
   *
   * @param {string} plaintext - The API key to encrypt
   * @returns {Promise<string>} Base64-encoded ciphertext (IV + ciphertext)
   * @throws {Error} if IndexedDB is unavailable or key generation fails
   */
  Encryption.encrypt = function (plaintext) {
    var self = this;
    if (!encryptionKey) {
      return this.init().then(function () {
        if (!encryptionKey) {
          return _generateAndStoreKey();
        }
        return true;
      }).then(function () {
        return self.encrypt(plaintext);
      });
    }

    var data = new TextEncoder().encode(plaintext);
    var iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    return crypto.subtle.encrypt(
      { name: ALGORITHM, iv: iv },
      encryptionKey,
      data
    ).then(function (ciphertext) {
      var combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return _arrayBufferToBase64(combined.buffer);
    }).catch(function (e) {
      // CENSORED: log error type only, NOT the key or plaintext
      throw new Error('Error al cifrar: ' + e.name);
    });
  };

  /**
   * Decrypt a base64-encoded ciphertext.
   * Does NOT generate a new key — if no key exists, throws an error.
   *
   * @param {string} encryptedData - Base64 string (iv + ciphertext)
   * @returns {Promise<string>} Decrypted plaintext
   * @throws {Error} if key is not initialized or decryption fails
   */
  Encryption.decrypt = function (encryptedData) {
    if (!encryptionKey) {
      return this.init().then(function () {
        if (!encryptionKey) {
          throw new Error('No se encontro la clave de cifrado. ' +
            'Si borraste los datos del navegador, tienes que reconfigurar tus proveedores.');
        }
        return Encryption.decrypt(encryptedData);
      });
    }

    var combined = _base64ToArrayBuffer(encryptedData);
    var iv = combined.slice(0, IV_LENGTH);
    var ciphertext = combined.slice(IV_LENGTH);

    return crypto.subtle.decrypt(
      { name: ALGORITHM, iv: iv },
      encryptionKey,
      ciphertext
    ).then(function (plaintext) {
      return new TextDecoder().decode(plaintext);
    }).catch(function () {
      throw new Error('Error al descifrar: clave incorrecta o datos corruptos');
    });
  };

  /**
   * Check if Web Crypto API + IndexedDB are available.
   * @returns {boolean}
   */
  Encryption.isSupported = function () {
    return typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined' &&
           typeof indexedDB !== 'undefined';
  };

  /**
   * Clear the encryption key from IndexedDB.
   * Does NOT delete encrypted provider data — those become inaccessible.
   * @returns {Promise<boolean>}
   */
  Encryption.clearKey = function () {
    encryptionKey = null;
    _deleteLegacyKey();  // Also clean up any leftover legacy key
    return _deleteKeyFromDB().then(function () {
      return true;
    });
  };

  /**
   * Reset encryption key.
   * WARNING: All previously encrypted data becomes inaccessible.
   * @returns {Promise<boolean>}
   */
  Encryption.resetKey = function () {
    var self = this;
    return this.clearKey().then(function () {
      return _generateAndStoreKey();
    });
  };

  /**
   * Get key creation info (metadata only, NO key material).
   * @returns {Promise<Object|null>} { name, created, algorithm, length } or null
   */
  Encryption.getKeyInfo = function () {
    return _openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(KEY_RECORD_NAME);

        req.onsuccess = function () {
          var record = req.result;
          if (record) {
            resolve({
              name: record.name,
              created: record.created,
              algorithm: ALGORITHM,
              length: KEY_LENGTH,
              extractable: false
            });
          } else {
            resolve(null);
          }
        };

        req.onerror = function () {
          reject(null);
        };

        tx.oncomplete = function () {
          db.close();
        };
      });
    }).catch(function () {
      return null;
    });
  };

  /**
   * Derive key from user password (for future enhancement with master password).
   * Currently unused — placeholder for Bloque C/F.
   * @param {string} password
   * @param {Uint8Array} salt
   * @returns {Promise<CryptoKey>}
   */
  Encryption.deriveKeyFromPassword = function (password, salt) {
    var encoder = new TextEncoder();
    var keyMaterial;

    return crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    ).then(function (km) {
      keyMaterial = km;
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: ALGORITHM, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    });
  };

  /* ═══════════════════════════════════════════════════════════════════
     Utility functions
     ═══════════════════════════════════════════════════════════════════ */

  function _arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function _base64ToArrayBuffer(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Auto-init: load key on script load (silent, no key generation)
     ═══════════════════════════════════════════════════════════════════ */

  // Attempt to init without blocking. If it fails (IndexedDB unavailable),
  // the module will still work — encrypt/decrypt will throw a clear error.
  Encryption.init().catch(function (e) {
    console.warn('[Encryption] Init error:', e.message);
  });

  /* ═══════════════════════════════════════════════════════════════════
     Export
     ═══════════════════════════════════════════════════════════════════ */

  window.Encryption = Encryption;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Encryption;
  }
})();
