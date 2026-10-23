import { PanelClass } from './bq/panel_class';

const PANEL_ID = 'bq-tm-panel';
const BOOT_INTERVAL_MS = 400;
const BOOT_TIMEOUT_MS = 120_000;

/**
 * Sukuria panelę, jei dar nėra ir yra document.body.
 */
function tryInitPanel(): boolean {
  if (!document.body) {
    return false;
  }

  if (document.getElementById(PANEL_ID)) {
    return true;
  }

  new PanelClass();
  return true;
}

/**
 * Kartoja inicializaciją, kol GCP SPA užsikrauna.
 */
function startBoot(): void {
  if (tryInitPanel()) {
    return;
  }

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (tryInitPanel() || Date.now() - startedAt > BOOT_TIMEOUT_MS) {
      window.clearInterval(timer);
    }
  }, BOOT_INTERVAL_MS);
}

startBoot();

const observer = new MutationObserver(() => {
  tryInitPanel();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
