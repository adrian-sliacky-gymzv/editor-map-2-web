/* Entry point for the complete Editor máp 2 clone. */

import { classicData } from './classic-data.js';
import { initActivities, openActivityFromQuery } from './classic-activities.js';
import { initEditor, openEditorAt } from './editor.js';
import { toast } from './classic-ui.js';

async function boot() {
  try {
    await initActivities();
    await initEditor();
    // Preload the configuration and map index; scenes and .mef files stay lazy.
    await classicData.init();
    handleDeepLink();
  } catch (error) {
    console.error(error);
    toast(`Aplikáciu sa nepodarilo spustiť: ${error.message}`, 'error', 6000);
  }
}

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('editor') === '1' || params.get('view') === 'editor') {
    openEditorAt(params.get('map') || null);
    return;
  }
  const mode = params.get('mode');
  if (mode === 'test' || mode === 'distance' || mode === 'puzzle') {
    openActivityFromQuery({
      mode,
      mapKey: params.get('map') || null,
      testIndex: params.get('testIndex') || params.get('test') || 0,
      levelIndex: params.get('levelIndex') || params.get('level') || 0,
      numQ: params.get('numQ') || params.get('q') || 3,
      autostart: params.get('autostart') === '1' || params.get('play') === '1',
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
