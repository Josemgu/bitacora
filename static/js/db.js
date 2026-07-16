/**
 * ============================================================================
 * DB.js — Capa de persistencia de Bitácora
 * ============================================================================
 * Implementa una base de datos sobre localStorage con prefijo 'bitacora_'.
 * Namespace global: DB
 * Depende de: SEED_DATA (definido en data/seed.js, cargado antes que este archivo)
 * ----------------------------------------------------------------------------
 * Uso:  DB.getAll('phases')  |  DB.insert('topics', {...})  |  etc.
 * ============================================================================
 */

// Namespace global
var DB = (function () {
    'use strict';

    /* ────────────────────────  constantes  ──────────────────────── */

    /** Prefijo para todas las claves de localStorage (evita colisiones). */
    var PREFIX = 'bitacora_';

    /* ────────────────────────  listado de tablas  ──────────────────────── */

    var TABLES = [
        'phases',
        'topics',
        'subtopics',
        'resources',
        'resource_queue',
        'projects',
        'project_requirements',
        'log_entries',
        'ai_providers',
        'health_events',
        'messages',
        'notes'
    ];

    /* ═══════════════════════════════════════════════════════════════════════
       FUNCIONES PRIVADAS (helpers)
       ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Genera la clave completa en localStorage para una tabla.
     * @param {string} table — nombre de la tabla
     * @returns {string}     — clave con prefijo
     */
    function _key(table) {
        return PREFIX + table;
    }

    /**
     * Lee la tabla completa desde localStorage.
     * @param {string} table — nombre de la tabla
     * @returns {Array}      — array de registros (vacío si falla o no existe)
     */
    function _read(table) {
        try {
            var raw = localStorage.getItem(_key(table));
            if (raw === null) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.error('[DB] Error leyendo tabla "' + table + '":', err);
            return [];
        }
    }

    /**
     * Escribe el array completo de una tabla en localStorage.
     * Operacion atomica: reemplaza el valor anterior.
     * @param {string} table — nombre de la tabla
     * @param {Array} data   — array de registros a guardar
     * @returns {boolean}    — true si se guardo correctamente
     */
    function _write(table, data) {
        try {
            localStorage.setItem(_key(table), JSON.stringify(data));
            return true;
        } catch (err) {
            console.error('[DB] Error escribiendo tabla "' + table + '":', err);
            return false;
        }
    }

    /**
     * Valida que el nombre de tabla sea conocido.
     * @param {string} table — nombre de la tabla
     * @returns {boolean}
     */
    function _validTable(table) {
        if (TABLES.indexOf(table) === -1) {
            console.error('[DB] Tabla desconocida: "' + table + '"');
            return false;
        }
        return true;
    }

    /**
     * Obtiene la marca de tiempo ISO actual.
     * @returns {string} — fecha/hora en formato ISO 8601
     */
    function _nowISO() {
        return new Date().toISOString();
    }

    /* ═══════════════════════════════════════════════════════════════════════
       API PUBLICA
       ═══════════════════════════════════════════════════════════════════════ */

    var API = {};

    /* ── listado de tablas ── */
    API.TABLES = TABLES;

    /* ── init ── */

    /**
     * Inicializa la base de datos.
     * Si localStorage esta vacio para una tabla, carga desde SEED_DATA
     * (definido en data/seed.js). Si la tabla no existe en SEED_DATA,
     * crea un array vacio.
     * @returns {void}
     */
    API.init = function () {
        try {
            TABLES.forEach(function (table) {
                var key = _key(table);
                var exists = localStorage.getItem(key) !== null;

                if (!exists) {
                    var seed = (typeof SEED_DATA !== 'undefined' && SEED_DATA[table])
                        ? SEED_DATA[table]
                        : [];

                    // Asegurar que sea array
                    if (!Array.isArray(seed)) {
                        console.warn('[DB] SEED_DATA.' + table + ' no es array, usando []');
                        seed = [];
                    }

                    localStorage.setItem(key, JSON.stringify(seed));
                }
            });

            console.log('[DB] Base de datos inicializada. Tablas: ' + TABLES.join(', '));
        } catch (err) {
            console.error('[DB] Error durante init():', err);
        }
    };

    /* ── Lectura ── */

    /**
     * Obtiene todos los registros de una tabla.
     * @param {string} table — nombre de la tabla
     * @returns {Array}      — array de registros
     */
    API.getAll = function (table) {
        if (!_validTable(table)) return [];
        return _read(table);
    };

    /**
     * Busca un registro por su id exacto.
     * @param {string} table — nombre de la tabla
     * @param {number} id    — identificador del registro
     * @returns {Object|null}
     */
    API.getById = function (table, id) {
        if (!_validTable(table)) return null;
        var data = _read(table);
        for (var i = 0; i < data.length; i++) {
            if (data[i].id === id) return data[i];
        }
        return null;
    };

    /**
     * Filtra registros usando una funcion de predicado.
     * @param {string}   table    — nombre de la tabla
     * @param {Function} filterFn — funcion que recibe (record) => boolean
     * @returns {Array}
     */
    API.query = function (table, filterFn) {
        if (!_validTable(table)) return [];
        var data = _read(table);
        if (typeof filterFn !== 'function') return data;
        var result = [];
        for (var i = 0; i < data.length; i++) {
            if (filterFn(data[i])) result.push(data[i]);
        }
        return result;
    };

    /**
     * Devuelve el primer registro que cumpla el predicado.
     * @param {string}   table    — nombre de la tabla
     * @param {Function} filterFn — funcion que recibe (record) => boolean
     * @returns {Object|null}
     */
    API.findOne = function (table, filterFn) {
        if (!_validTable(table)) return null;
        var data = _read(table);
        if (typeof filterFn !== 'function') return data.length > 0 ? data[0] : null;
        for (var i = 0; i < data.length; i++) {
            if (filterFn(data[i])) return data[i];
        }
        return null;
    };

    /* ── Escritura ── */

    /**
     * Inserta un nuevo registro en una tabla.
     * Asigna id automatico y anade created_at si no existe.
     * @param {string} table  — nombre de la tabla
     * @param {Object} record — datos del registro (sin id o con id sobrescrito)
     * @returns {Object|null} — el registro insertado, o null si falla
     */
    API.insert = function (table, record) {
        if (!_validTable(table)) return null;

        try {
            var data = _read(table);
            var newRecord = {};

            // Copiar propiedades del registro entrante
            for (var key in record) {
                if (record.hasOwnProperty(key)) {
                    newRecord[key] = record[key];
                }
            }

            // Asignar id automatico
            newRecord.id = API.getNextId(table);

            // Anadir created_at si no existe
            if (!newRecord.created_at) {
                newRecord.created_at = _nowISO();
            }

            data.push(newRecord);

            if (_write(table, data)) {
                return newRecord;
            }
            return null;
        } catch (err) {
            console.error('[DB] Error en insert("' + table + '"):', err);
            return null;
        }
    };

    /**
     * Actualiza un registro existente mediante merge de propiedades.
     * @param {string} table   — nombre de la tabla
     * @param {number} id      — identificador del registro
     * @param {Object} changes — propiedades a modificar
     * @returns {Object|null}  — registro actualizado, o null si no se encontro
     */
    API.update = function (table, id, changes) {
        if (!_validTable(table)) return null;

        try {
            var data = _read(table);
            for (var i = 0; i < data.length; i++) {
                if (data[i].id === id) {
                    // Merge: copiar propiedades de changes al registro existente
                    for (var key in changes) {
                        if (changes.hasOwnProperty(key)) {
                            data[i][key] = changes[key];
                        }
                    }

                    // Anadir updated_at
                    data[i].updated_at = _nowISO();

                    if (_write(table, data)) {
                        return data[i];
                    }
                    return null;
                }
            }
            console.warn('[DB] update("' + table + '", ' + id + '): registro no encontrado');
            return null;
        } catch (err) {
            console.error('[DB] Error en update("' + table + '", ' + id + '):', err);
            return null;
        }
    };

    /**
     * Elimina un registro de una tabla.
     * Para 'resources' realiza soft-delete (cambia status a 'archived').
     * Para 'resource_queue' y otras tablas realiza hard-delete fisico.
     * @param {string} table  — nombre de la tabla
     * @param {number} id     — identificador del registro
     * @returns {boolean}     — true si se encontro y proceso el registro
     */
    API.delete = function (table, id) {
        if (!_validTable(table)) return false;

        try {
            // Caso especial: resources -> soft delete (archivar)
            if (table === 'resources') {
                var updated = API.update(table, id, { status: 'archived' });
                return updated !== null;
            }

            // Hard delete para el resto (incluido resource_queue)
            var data = _read(table);
            var found = false;
            var filtered = [];
            for (var i = 0; i < data.length; i++) {
                if (data[i].id === id) {
                    found = true;
                } else {
                    filtered.push(data[i]);
                }
            }

            if (found) {
                _write(table, filtered);
                return true;
            }

            console.warn('[DB] delete("' + table + '", ' + id + '): registro no encontrado');
            return false;
        } catch (err) {
            console.error('[DB] Error en delete("' + table + '", ' + id + '):', err);
            return false;
        }
    };

    /* ── Utilidades de IDs ── */

    /**
     * Calcula el siguiente id disponible para una tabla.
     * @param {string} table — nombre de la tabla
     * @returns {number}     — max(id) + 1, o 1 si la tabla esta vacia
     */
    API.getNextId = function (table) {
        if (!_validTable(table)) return 1;
        var data = _read(table);
        if (data.length === 0) return 1;

        var max = 0;
        for (var i = 0; i < data.length; i++) {
            if (data[i].id > max) max = data[i].id;
        }
        return max + 1;
    };

    /* ═══════════════════════════════════════════════════════════════════════
       IMPORT / EXPORT / RESET
       ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Exporta todas las tablas como un objeto JSON plano.
     * Ideal para hacer backups manuales.
     * @returns {Object} — { phases: [...], topics: [...], ... }
     */
    API.exportAll = function () {
        var data = {};
        try {
            TABLES.forEach(function (table) {
                data[table] = _read(table);
            });
        } catch (err) {
            console.error('[DB] Error en exportAll():', err);
        }
        return data;
    };

    /**
     * Importa datos previamente exportados con exportAll().
     * Valida que el objeto contenga las tablas necesarias.
     * @param {Object} data — objeto con las tablas a importar
     * @returns {boolean}   — true si la importacion fue exitosa
     */
    API.importAll = function (data) {
        try {
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                console.error('[DB] importAll(): el parametro debe ser un objeto');
                return false;
            }

            // Validar que contenga al menos una tabla conocida
            var hasValidTable = false;
            for (var i = 0; i < TABLES.length; i++) {
                if (data.hasOwnProperty(TABLES[i])) {
                    hasValidTable = true;
                    break;
                }
            }
            if (!hasValidTable) {
                console.error('[DB] importAll(): no se encontraron tablas validas en los datos');
                return false;
            }

            // Importar cada tabla presente en los datos
            TABLES.forEach(function (table) {
                if (data.hasOwnProperty(table) && Array.isArray(data[table])) {
                    _write(table, data[table]);
                }
            });

            console.log('[DB] Importacion completada exitosamente.');
            return true;
        } catch (err) {
            console.error('[DB] Error en importAll():', err);
            return false;
        }
    };

    /**
     * Limpia TODOS los datos y reinicializa desde SEED_DATA.
     * Util para volver al estado inicial de la aplicacion.
     * @returns {void}
     */
    API.reset = function () {
        try {
            TABLES.forEach(function (table) {
                localStorage.removeItem(_key(table));
            });
            API.init();
            console.log('[DB] Base de datos reiniciada desde seed.');
        } catch (err) {
            console.error('[DB] Error en reset():', err);
        }
    };

    /* ═══════════════════════════════════════════════════════════════════════
       UTILIDADES
       ═══════════════════════════════════════════════════════════════════════ */

    /**
     * Cuenta registros de una tabla, opcionalmente filtrados.
     * @param {string}   table    — nombre de la tabla
     * @param {Function} [filterFn] — funcion opcional (record) => boolean
     * @returns {number}
     */
    API.count = function (table, filterFn) {
        if (!_validTable(table)) return 0;
        var data = _read(table);
        if (typeof filterFn !== 'function') return data.length;

        var c = 0;
        for (var i = 0; i < data.length; i++) {
            if (filterFn(data[i])) c++;
        }
        return c;
    };

    /**
     * Verifica si existe al menos un registro que cumpla el predicado.
     * @param {string}   table    — nombre de la tabla
     * @param {Function} [filterFn] — funcion opcional (record) => boolean
     * @returns {boolean}
     */
    API.exists = function (table, filterFn) {
        if (!_validTable(table)) return false;
        var data = _read(table);
        if (typeof filterFn !== 'function') return data.length > 0;

        for (var i = 0; i < data.length; i++) {
            if (filterFn(data[i])) return true;
        }
        return false;
    };

    /* ────────────────────────  retornar API  ──────────────────────── */

    return API;

})();

/* ═══════════════════════════════════════════════════════════════════════════
   Auto-inicializacion al cargar el DOM
   ═══════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', DB.init);