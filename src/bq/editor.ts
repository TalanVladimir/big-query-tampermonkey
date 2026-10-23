/**
 * Grąžina aktyvų / matomą Monaco redaktorių BigQuery konsolėje.
 */
export function getActiveMonacoRoot(): HTMLElement | null {
  const focused = document.querySelector(
    '.monaco-editor.focused',
  ) as HTMLElement | null;

  if (focused) {
    return focused;
  }

  const editors = Array.from(
    document.querySelectorAll('.monaco-editor'),
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

  textarea.focus();
  textarea.select();
  const inserted = document.execCommand('insertText', false, sql);

  if (!inserted) {
    textarea.value = sql;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Kopijuoja tekstą į iškarpinę.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}
