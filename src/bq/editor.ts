import { findBigQueryHostDocument } from './host_document';

type MonacoEditorLike = {
  getValue: () => string;
  hasTextFocus?: () => boolean;
  getDomNode?: () => HTMLElement | null;
  setValue?: (value: string) => void;
};

type MonacoWindow = Window & {
  monaco?: {
    editor?: {
      getEditors: () => MonacoEditorLike[];
    };
  };
};

const trackedDocuments = new WeakSet<Document>();

let lastActiveMonacoRoot: HTMLElement | null = null;

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
 * Įsimena paskutinį Monaco, kuriame buvo fokusas (query langas).
 */
export function trackActiveMonacoEditor(doc: Document): void {
  if (trackedDocuments.has(doc)) {
    return;
  }

  trackedDocuments.add(doc);
  doc.addEventListener(
    'focusin',
    event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const root = target.closest('.monaco-editor');
      if (root instanceof HTMLElement) {
        lastActiveMonacoRoot = root;
      }
    },
    true,
  );
}

/**
 * Monaco instance, susieta su konkrečiu .monaco-editor elementu.
 */
function getMonacoForRoot(
  root: HTMLElement,
  hostWin: MonacoWindow,
): MonacoEditorLike | null {
  const editors = hostWin.monaco?.editor?.getEditors?.() ?? [];

  for (const editor of editors) {
    const node = editor.getDomNode?.();
    if (!node) {
      continue;
    }

    const monacoRoot = node.closest('.monaco-editor');
    if (monacoRoot === root || root.contains(node)) {
      return editor;
    }
  }

  const withEditor = root as HTMLElement & {
    __monaco_editor__?: MonacoEditorLike;
  };

  return withEditor.__monaco_editor__ ?? null;
}

/**
 * Aktyvus query redaktorius: fokusuotas textarea / .focused / paskutinis query langas.
 */
export function getActiveMonacoRoot(): HTMLElement | null {
  const doc = findBigQueryHostDocument();
  if (!doc) {
    return null;
  }

  const active = doc.activeElement;
  if (active instanceof HTMLElement) {
    const fromActive = active.closest('.monaco-editor');
    if (fromActive instanceof HTMLElement) {
      return fromActive;
    }
  }

  const focused = doc.querySelector('.monaco-editor.focused');
  if (focused instanceof HTMLElement) {
    return focused;
  }

  const hostWin = (doc.defaultView ?? window) as MonacoWindow;
  for (const editor of hostWin.monaco?.editor?.getEditors?.() ?? []) {
    if (!editor.hasTextFocus?.()) {
      continue;
    }

    const node = editor.getDomNode?.();
    const root = node?.closest('.monaco-editor');
    if (root instanceof HTMLElement) {
      return root;
    }
  }

  if (lastActiveMonacoRoot?.isConnected) {
    return lastActiveMonacoRoot;
  }

  return null;
}

/**
 * Nuskaito SQL iš aktyvio (fokusuoto) Monaco textarea.
 */
export function readActiveEditorSql(): string {
  const doc = getHostDocument();
  trackActiveMonacoEditor(doc);

  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Spustelėk į aktyvų query langą ir bandyk dar kartą.');
  }

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (textarea && textarea.value.length > 0) {
    return textarea.value;
  }

  const hostWin = (root.ownerDocument.defaultView ?? window) as MonacoWindow;
  const monacoEditor = getMonacoForRoot(root, hostWin);
  const fromMonaco = monacoEditor?.getValue() ?? '';

  if (fromMonaco.trim()) {
    return fromMonaco;
  }

  throw new Error(
    'Aktyvus query langas tuščias — spustelėk redaktorių ir bandyk dar kartą.',
  );
}

/**
 * Pakeičia visą SQL tekstą aktyviame redaktoriuje.
 */
export function writeActiveEditorSql(sql: string): void {
  const doc = getHostDocument();
  trackActiveMonacoEditor(doc);

  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Spustelėk į aktyvų query langą ir bandyk dar kartą.');
  }

  const hostWin = (root.ownerDocument.defaultView ?? window) as MonacoWindow;
  const monacoEditor = getMonacoForRoot(root, hostWin);

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
