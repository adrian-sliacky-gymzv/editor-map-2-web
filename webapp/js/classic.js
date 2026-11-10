/* Entry point for the complete Editor máp 2 clone. */

import { classicData } from './classic-data.js';
import { initActivities, openActivityFromQuery } from './classic-activities.js';
import { initEditor, openEditorAt } from './editor.js';
import { registerRoute, startRouter } from './navigation.js';
import { toast } from './classic-ui.js';

async function boot() {
  try {
    await initActivities();
    await initEditor();
    // Preload the configuration and map index; scenes and .mef files stay lazy.
    await classicData.init();
    registerRoutes();
    startRouter();
  } catch (error) {
    console.error(error);
    toast(`Aplikáciu sa nepodarilo spustiť: ${error.message}`, 'error', 6000);
  }
}

function registerRoutes() {
  registerRoute('classic-setup', (route) => openActivityFromQuery(
    { ...route, autostart: false },
    { history: false, replace: true }
  ));
  registerRoute('classic-game', (route) => openActivityFromQuery(
    { ...route, autostart: true },
    { history: false, replace: true }
  ));
  registerRoute('editor', (route) => openEditorAt(route.mapKey, { history: false }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
