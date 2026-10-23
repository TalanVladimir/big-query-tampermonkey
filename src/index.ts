import { PanelClass } from './bq/panel_class';

const PANEL_ID = 'bq-tm-panel';

/**
 * Inicijuoja BigQuery Tampermonkey panelę, kai puslapis paruoštas.
 */
function init(): void {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  new PanelClass();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
