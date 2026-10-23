import { PanelClass } from './bq/panel_class';
import {
  findBigQueryHostDocument,
  isBigQueryContext,
} from './bq/host_document';

const PANEL_ID = 'bq-tm-panel';
const BOOT_INTERVAL_MS = 400;
const BOOT_TIMEOUT_MS = 180_000;

const observedDocs = new WeakSet<Document>();

/**
 * Stebi DOM pokyčius dokumente (iframe užkrovimui).
 */
function observeDocument(doc: Document): void {
  if (observedDocs.has(doc)) {
    return;
  }

  observedDocs.add(doc);
  const observer = new MutationObserver(() => {
    tryInitPanel();
  });

  observer.observe(doc.documentElement, { childList: true, subtree: true });
}

/**
 * Užregistruoja stebėjimą visuose pasiekiamuose iframe.
 */
function observeAccessibleFrames(doc: Document = document): void {
  observeDocument(doc);

  const iframes = Array.from(doc.querySelectorAll('iframe'));
  for (const iframe of iframes) {
    try {
      const childDoc = iframe.contentDocument;
      if (childDoc) {
        observeAccessibleFrames(childDoc);
      }
    } catch {
      continue;
    }
  }
}

/**
 * Sukuria panelę host dokumente, kai BigQuery UI paruoštas.
 */
function tryInitPanel(): boolean {
  if (!isBigQueryContext()) {
    return false;
  }

  const hostDoc = findBigQueryHostDocument();
  if (!hostDoc?.body) {
    return false;
  }

  if (hostDoc.getElementById(PANEL_ID)) {
    return true;
  }

  new PanelClass(hostDoc);
  return true;
}

/**
 * Kartoja inicializaciją, kol GCP SPA užsikrauna.
 */
function startBoot(): void {
  observeAccessibleFrames();

  if (tryInitPanel()) {
    return;
  }

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    observeAccessibleFrames();
    if (tryInitPanel() || Date.now() - startedAt > BOOT_TIMEOUT_MS) {
      window.clearInterval(timer);
    }
  }, BOOT_INTERVAL_MS);
}

startBoot();
