const DB = (function() {
    'use strict';

    var TABLES = [
        'phases', 'topics', 'subtopics', 'resources',
        'resource_queue', 'projects', 'project_requirements',
        'log_entries', 'ai_providers', 'health_events',
        'messages', 'notes'
    ];

    function _key(t) { return 'bitacora_' + t; }

    function init() {
        TABLES.forEach(function(table) {
            if (!localStorage.getItem(_key(table))) {
                if (typeof SEED_DATA !== 'undefined' && SEED_DATA[table]) {
                    localStorage.setItem(_key(table), JSON.stringify(SEED_DATA[table]));
                } else {
                    localStorage.setItem(_key(table), JSON.stringify([]));
                }
            }
        });
    }

    function getAll(table) {
        var data = localStorage.getItem(_key(table));
        return data ? JSON.parse(data) : [];
    }

    function getById(table, id) {
        var items = getAll(table);
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    }

    function query(table, filterFn) {
        var items = getAll(table);
        if (!filterFn) return items;
        var result = [];
        for (var i = 0; i < items.length; i++) {
            if (filterFn(items[i])) result.push(items[i]);
        }
        return result;
    }

    function findOne(table, filterFn) {
        var items = getAll(table);
        for (var i = 0; i < items.length; i++) {
            if (filterFn(items[i])) return items[i];
        }
        return null;
    }

    function insert(table, record) {
        var items = getAll(table);
        record.id = record.id || getNextId(table);
        if (!record.created_at) record.created_at = new Date().toISOString();
        items.push(record);
        localStorage.setItem(_key(table), JSON.stringify(items));
        return record;
    }

    function update(table, id, changes) {
        var items = getAll(table);
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                var updated = Object.assign({}, items[i], changes);
                items[i] = updated;
                localStorage.setItem(_key(table), JSON.stringify(items));
                return updated;
            }
        }
        return null;
    }

    function _delete(table, id) {
        var items = getAll(table);
        var removed = false;
        for (var i = items.length - 1; i >= 0; i--) {
            if (items[i].id === id) {
                items.splice(i, 1);
                removed = true;
            }
        }
        if (removed) {
            localStorage.setItem(_key(table), JSON.stringify(items));
        }
        return removed;
    }

    function deleteResource(id) {
        return update('resources', id, { status: 'archived' });
    }

    function getNextId(table) {
        var items = getAll(table);
        var max = 0;
        for (var i = 0; i < items.length; i++) {
            if (items[i].id > max) max = items[i].id;
        }
        return max + 1;
    }

    function exportAll() {
        var data = {};
        TABLES.forEach(function(t) {
            data[t] = getAll(t);
        });
        return data;
    }

    function importAll(data) {
        for (var table in data) {
            if (TABLES.indexOf(table) >= 0) {
                localStorage.setItem(_key(table), JSON.stringify(data[table]));
            }
        }
        return true;
    }

    function reset() {
        TABLES.forEach(function(t) {
            localStorage.removeItem(_key(t));
        });
        init();
    }

    return {
        TABLES: TABLES,
        init: init,
        getAll: getAll,
        getById: getById,
        query: query,
        findOne: findOne,
        insert: insert,
        update: update,
        delete: _delete,
        deleteResource: deleteResource,
        getNextId: getNextId,
        exportAll: exportAll,
        importAll: importAll,
        reset: reset
    };
})();

document.addEventListener('DOMContentLoaded', DB.init);
