import { findBigQueryHostDocument } from './host_document';

type MonacoRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

type MonacoSelection = MonacoRange & {
  isEmpty?: () => boolean;
};

type MonacoTextModel = {
  getValue: () => string;
  getValueInRange?: (range: MonacoRange) => string;
};

type MonacoEditorLike = {
  getValue: () => string;
  hasTextFocus?: () => boolean;
  getDomNode?: () => HTMLElement | null;
  getModel?: () => MonacoTextModel | null;
  getSelection?: () => MonacoSelection | null;
  setValue?: (value: string) => void;
  executeEdits?: (
    source: string,
    edits: Array<{
      range: MonacoRange;
      text: string;
      forceMoveMarkers?: boolean;
    }>,
  ) => void;
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
 * Visi same-origin langai (įskaitant iframe).
 */
function listMonacoWindows(startDoc: Document): MonacoWindow[] {
  const result: MonacoWindow[] = [];
  const seen = new Set<Window>();

  const walk = (current: Document): void => {
    const win = current.defaultView;
    if (win && !seen.has(win)) {
      seen.add(win);
      result.push(win as MonacoWindow);
    }

    current.querySelectorAll('iframe').forEach(frame => {
      try {
        const childDoc = frame.contentDocument;
        if (childDoc) {
          walk(childDoc);
        }
      } catch {
        /* cross-origin */
      }
    });
  };

  walk(startDoc);
  return result;
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
 * Monaco ant DOM elemento (GCP kartais be window.monaco).
 */
function findMonacoOnElement(root: HTMLElement): MonacoEditorLike | null {
  const record = root as HTMLElement & Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!key.startsWith('__monaco')) {
      continue;
    }

    const candidate = record[key];
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof (candidate as MonacoEditorLike).getValue === 'function'
    ) {
      return candidate as MonacoEditorLike;
    }
  }

  const withEditor = root as HTMLElement & {
    __monaco_editor__?: MonacoEditorLike;
  };

  return withEditor.__monaco_editor__ ?? null;
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

    if (root === node || root.contains(node) || node.contains(root)) {
      return editor;
    }

    const monacoRoot = node.closest('.monaco-editor');
    if (monacoRoot === root) {
      return editor;
    }
  }

  return null;
}

/**
 * Randa Monaco redaktorių aktyviam .monaco-editor (visuose iframe).
 */
function resolveMonacoEditor(root: HTMLElement): MonacoEditorLike | null {
  const doc = root.ownerDocument;
  if (!doc) {
    return findMonacoOnElement(root);
  }

  for (const win of listMonacoWindows(doc)) {
    const editor = getMonacoForRoot(root, win);
    if (editor) {
      return editor;
    }
  }

  return findMonacoOnElement(root);
}

/**
 * Pilnas tekstas iš Monaco modelio.
 */
function readMonacoFullText(editor: MonacoEditorLike): string {
  const fromModel = editor.getModel?.()?.getValue();
  if (fromModel && fromModel.length > 0) {
    return fromModel;
  }

  return editor.getValue();
}

/**
 * Bandymas nuskaityti per Ctrl+A (Monaco sinchronizuoja į textarea).
 */
function tryReadViaSelectAll(root: HTMLElement): string {
  const win = root.ownerDocument?.defaultView;
  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (!win || !textarea) {
    return '';
  }

  textarea.focus();
  win.document.execCommand('selectAll');

  const value = textarea.value;
  const end = value.length;
  textarea.setSelectionRange(end, end);

  return value;
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

  for (const win of listMonacoWindows(doc)) {
    for (const editor of win.monaco?.editor?.getEditors?.() ?? []) {
      if (!editor.hasTextFocus?.()) {
        continue;
      }

      const node = editor.getDomNode?.();
      const root = node?.closest('.monaco-editor');
      if (root instanceof HTMLElement) {
        return root;
      }
    }
  }

  if (lastActiveMonacoRoot?.isConnected) {
    return lastActiveMonacoRoot;
  }

  return null;
}

/**
 * Pasirenka ilgiausią kandidatą (pilnas query tekstas).
 */
function pickLongestText(candidates: string[]): string {
  return candidates.reduce(
    (longest, current) => (current.length > longest.length ? current : longest),
    '',
  );
}

/**
 * Ar SQL atrodo sutrumpintas (dažna Monaco/BQ klaida).
 */
function looksTruncatedSql(sql: string): boolean {
  if (!/\bwith\b/i.test(sql)) {
    return false;
  }

  const fromCount = (sql.match(/\bfrom\b/gi) ?? []).length;

  if (fromCount >= 8 || sql.length >= 4500) {
    return false;
  }

  if (fromCount <= 2 && sql.length < 6000) {
    return true;
  }

  return sql.length < 1000;
}

/**
 * Nuskaito SQL per Select All + Copy + clipboard (pilnas query tekstas BQ).
 */
async function tryReadViaClipboardCopy(root: HTMLElement): Promise<string> {
  const win = root.ownerDocument?.defaultView;
  if (!win) {
    return '';
  }

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (textarea) {
    textarea.focus();
  } else {
    root.focus();
  }

  win.document.execCommand('selectAll');
  win.document.execCommand('copy');

  if (!win.navigator.clipboard?.readText) {
    return '';
  }

  try {
    return await win.navigator.clipboard.readText();
  } catch {
    return '';
  }
}

/**
 * Surenka SQL kandidatus iš aktyvio redaktoriaus.
 */
function collectSqlCandidates(root: HTMLElement): string[] {
  const candidates: string[] = [];

  const monacoEditor = resolveMonacoEditor(root);
  if (monacoEditor) {
    candidates.push(readMonacoFullText(monacoEditor));
  }

  candidates.push(tryReadViaSelectAll(root));

  const textarea = root.querySelector(
    'textarea.inputarea',
  ) as HTMLTextAreaElement | null;

  if (textarea?.value) {
    candidates.push(textarea.value);
  }

  return candidates.filter(text => text.length > 0);
}

/**
 * Nuskaito visą SQL iš aktyvio query redaktoriaus.
 */
export async function readActiveEditorSql(): Promise<string> {
  const doc = getHostDocument();
  trackActiveMonacoEditor(doc);

  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Spustelėk į aktyvų query langą ir bandyk dar kartą.');
  }

  const candidates = collectSqlCandidates(root);
  candidates.push(await tryReadViaClipboardCopy(root));

  const sql = pickLongestText(candidates);

  if (!sql.trim()) {
    throw new Error(
      'Aktyvus query langas tuščias — spustelėk redaktorių ir bandyk dar kartą.',
    );
  }

  if (looksTruncatedSql(sql)) {
    throw new Error(
      'Nuskaitytas ne visas SQL — spustelėk redaktorių, Ctrl+A, tada copy dar kartą.',
    );
  }

  return sql;
}

/**
 * Ar Monaco pažymėjimas ne tuščias.
 */
function isNonEmptyMonacoSelection(
  selection: MonacoSelection | null | undefined,
): selection is MonacoSelection {
  if (!selection) {
    return false;
  }

  if (selection.isEmpty?.()) {
    return false;
  }

  return !(
    selection.startLineNumber === selection.endLineNumber &&
    selection.startColumn === selection.endColumn
  );
}

export type ActiveEditorWriteContext = {
  /** Tekstas, kurį transformuoti (pažymėjimas arba visas query). */
  text: string;
  /** Įrašo transformuotą tekstą atgal į redaktorių. */
  replaceWith: (newText: string) => void;
};

/**
 * Nuskaito pažymėtą SQL arba visą aktyvų query ir grąžina replace callback.
 */
export function getActiveEditorWriteContext(): ActiveEditorWriteContext {
  const doc = getHostDocument();
  trackActiveMonacoEditor(doc);

  const root = getActiveMonacoRoot();
  if (!root) {
    throw new Error('Spustelėk į aktyvų query langą ir bandyk dar kartą.');
  }

  const monacoEditor = resolveMonacoEditor(root);
  const selection = monacoEditor?.getSelection?.();
  const model = monacoEditor?.getModel?.();

  if (
    monacoEditor &&
    model?.getValueInRange &&
    isNonEmptyMonacoSelection(selection)
  ) {
    const selectedText = model.getValueInRange(selection);

    if (!selectedText.trim()) {
      throw new Error('Pažymėjimas tuščias.');
    }

    return {
      text: selectedText,
      replaceWith: newText => {
        if (monacoEditor.executeEdits) {
          monacoEditor.executeEdits('bq-tm', [
            { range: selection, text: newText, forceMoveMarkers: true },
          ]);
          return;
        }

        writeActiveEditorSql(newText);
      },
    };
  }

  const candidates = collectSqlCandidates(root);
  const sql = pickLongestText(candidates);

  if (!sql.trim()) {
    throw new Error(
      'Aktyvus query langas tuščias — pažymėk SQL arba spustelėk redaktorių.',
    );
  }

  if (looksTruncatedSql(sql)) {
    throw new Error(
      'Nuskaitytas ne visas SQL — pažymėk tekstą arba Ctrl+A, tada bandyk dar kartą.',
    );
  }

  return {
    text: sql,
    replaceWith: newText => writeActiveEditorSql(newText),
  };
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

  const monacoEditor = resolveMonacoEditor(root);

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
