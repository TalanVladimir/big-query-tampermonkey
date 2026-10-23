import { findBigQueryHostDocument } from './host_document';

/**
 * Dokumentas su BigQuery redaktoriumi.
 */
function getHostDocument(): Document {
  const doc = findBigQueryHostDocument();
  if (!doc) {
    throw new Error('Nepavyko rasti BigQuery puslapio dokumento.');
  }

  return doc;
}

/**
 * Grąžina aktyvų / matomą Monaco redaktorių BigQuery konsolėje.
 */
export function getActiveMonacoRoot(): HTMLElement | null {
  const doc = findBigQueryHostDocument();
  if (!doc) {
    return null;
  }

  const focused = doc.querySelector(
    '.monaco-editor.focused',
  ) as HTMLElement | null;

  if (focused) {
    return focused;
  }

  const editors = Array.from(
    doc.querySelectorAll('.monaco-editor'),
  ) as HTMLElement[];

  for (const editor of editors) {
    const rect = editor.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return editor;
    }
  }

  return editors[0] ?? null;
}

/**
 * Nuskaito SQL tekstą iš Monaco input slaptažodžio lauko.
 */
export function readActiveEditorSql(): string {
  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Nepavyko rasti BigQuery redaktoriaus.');
  }

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (!textarea || !textarea.value.trim()) {
    throw new Error('Aktyvus redaktorius tuščias arba nepasiekiamas.');
  }

  return textarea.value;
}

/**
 * Pakeičia visą SQL tekstą aktyviame redaktoriuje.
 */
export function writeActiveEditorSql(sql: string): void {
  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Nepavyko rasti BigQuery redaktoriaus.');
  }

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (!textarea) {
    throw new Error('Nepavyko pasiekti redaktoriaus teksto lauko.');
  }

  const view = root.ownerDocument.defaultView ?? window;

  textarea.focus();
  textarea.select();
  const inserted = view.document.execCommand('insertText', false, sql);

  if (!inserted) {
    textarea.value = sql;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Kopijuoja tekstą į iškarpinę.
 */
export async function copyToClipboard(text: string): Promise<void> {
  const hostWin = getHostDocument().defaultView ?? window;

  if (hostWin.navigator.clipboard?.writeText) {
    await hostWin.navigator.clipboard.writeText(text);
    return;
  }

  const doc = getHostDocument();
  const area = doc.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  doc.body.appendChild(area);
  area.select();
  doc.execCommand('copy');
  area.remove();
}
