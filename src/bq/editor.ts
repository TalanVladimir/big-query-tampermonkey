import { findBigQueryHostDocument } from './host_document';

type MonacoEditorLike = {
  getValue: () => string;
  hasTextFocus?: () => boolean;
};

type MonacoWindow = Window & {
  monaco?: {
    editor?: {
      getEditors: () => MonacoEditorLike[];
    };
  };
};

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
 * Monaco instance iš globalaus API arba elemento.
 */
function getMonacoEditorInstance(
  root: HTMLElement,
): MonacoEditorLike | null {
  const hostWin = (root.ownerDocument.defaultView ?? window) as MonacoWindow;
  const editors = hostWin.monaco?.editor?.getEditors?.();

  if (editors && editors.length > 0) {
    const focused = editors.find(editor => editor.hasTextFocus?.());
    return focused ?? editors[0];
  }

  const withEditor = root as HTMLElement & {
    __monaco_editor__?: MonacoEditorLike;
  };

  return withEditor.__monaco_editor__ ?? null;
}

/**
 * Tekstas iš Monaco view eilučių (atsarginis variantas).
 */
function readFromViewLines(root: HTMLElement): string | null {
  const lineNodes = root.querySelectorAll('.view-lines .view-line');
  if (lineNodes.length === 0) {
    return null;
  }

  const lines = Array.from(lineNodes).map(
    line => line.textContent?.replace(/\u00a0/g, ' ') ?? '',
  );

  return lines.join('\n');
}

/**
 * Nuskaito SQL tekstą iš aktyvio redaktoriaus.
 */
export function readActiveEditorSql(): string {
  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Nepavyko rasti BigQuery redaktoriaus.');
  }

  const monacoEditor = getMonacoEditorInstance(root);
  if (monacoEditor) {
    const value = monacoEditor.getValue().trim();
    if (value) {
      return monacoEditor.getValue();
    }
  }

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (textarea?.value.trim()) {
    return textarea.value;
  }

  const fromView = readFromViewLines(root);
  if (fromView?.trim()) {
    return fromView;
  }

  throw new Error('Aktyvus redaktorius tuščias arba nepasiekiamas.');
}

/**
 * Pakeičia visą SQL tekstą aktyviame redaktoriuje.
 */
export function writeActiveEditorSql(sql: string): void {
  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Nepavyko rasti BigQuery redaktoriaus.');
  }

  const monacoEditor = getMonacoEditorInstance(root) as MonacoEditorLike & {
    setValue?: (value: string) => void;
  };

  if (monacoEditor?.setValue) {
    monacoEditor.setValue(sql);
    return;
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
