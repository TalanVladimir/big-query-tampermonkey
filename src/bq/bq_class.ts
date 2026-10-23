import { findBigQueryHostDocument } from './host_document';
import { PanelClass } from './panel_class';

const PANEL_ID = 'bq-tm-panel';

/**
 * BigQuery Tampermonkey UI (kaip VIPA VipaClass).
 */
export class BqClass {
  /**
   * Inicijuoja panelę.
   */
  constructor() {
    this.loadPanel();

    window.setTimeout(() => {
      this.loadPanel();
    }, 3000);
  }

  /**
   * Įdeda panelę į dokumentą, kuriame yra redaktorius / GCP shell.
   */
  private loadPanel(): void {
    const hostDoc = findBigQueryHostDocument() ?? document;

    if (!hostDoc.body) {
      return;
    }

    if (hostDoc.getElementById(PANEL_ID)) {
      return;
    }

    new PanelClass(hostDoc);
  }
}
