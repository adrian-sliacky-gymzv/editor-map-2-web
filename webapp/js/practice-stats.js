/* ------------------------------------------------------------------------- */
/* Practice weaknesses — browser storage and change events                   */
/* ------------------------------------------------------------------------- */

import {
  emptyStore,
  listWeaknesses,
  normalizeStore,
  parseImportedStore,
  recordAttemptInStore,
  recordSessionInStore,
  serializeStore,
  summarizeStore,
} from './practice-stats-core.js';

const STORAGE_KEY = 'editorMap2.practiceStats.v1';
const listeners = new Set();

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch (error) {
    console.warn('Practice stats could not be loaded.', error);
    return emptyStore();
  }
}

let store = readStore();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (error) {
    // Quota can be reached after very long usage or a huge import. Sessions
    // are the only unbounded-ish history, so sacrifice old history first.
    try {
      store.sessions = [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    } catch (secondError) {
      console.warn('Practice stats could not be saved.', secondError || error);
      window.dispatchEvent(new CustomEvent('practice:error', {
        detail: { message: 'Štatistiky tréningu sa nepodarilo uložiť.' },
      }));
      return false;
    }
  }
}

function notify(reason) {
  const summary = summarizeStore(store);
  for (const listener of listeners) {
    try {
      listener(summary, reason);
    } catch (error) {
      console.warn('Practice stats listener failed.', error);
    }
  }
  window.dispatchEvent(new CustomEvent('practice:updated', {
    detail: { summary, reason },
  }));
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  try {
    store = event.newValue ? normalizeStore(JSON.parse(event.newValue)) : emptyStore();
    notify('storage');
  } catch (error) {
    console.warn('Practice stats storage event ignored.', error);
  }
});

export const practiceStats = {
  storageKey: STORAGE_KEY,

  get store() {
    return store;
  },

  summary() {
    return summarizeStore(store);
  },

  weaknesses(options = {}) {
    return listWeaknesses(store, options);
  },

  recordAttempt(attempt) {
    const record = recordAttemptInStore(store, attempt);
    if (record) {
      persist();
      notify('attempt');
    }
    return record;
  },

  recordSession(session) {
    const result = recordSessionInStore(store, session);
    if (result) {
      persist();
      notify('session');
    }
    return result;
  },

  reset() {
    store = emptyStore();
    persist();
    notify('reset');
  },

  exportJson() {
    return serializeStore(store);
  },

  importJson(text) {
    const next = parseImportedStore(text);
    store = next;
    persist();
    notify('import');
    return summarizeStore(store);
  },

  refresh() {
    store = readStore();
    notify('refresh');
    return store;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
