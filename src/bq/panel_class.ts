import { STORAGE_POSITION } from '../constants';
import {
  copyToClipboard,
  getActiveEditorWriteContext,
  readActiveEditorSql,
  writeActiveEditorSql,
} from './editor';
import { containsDbtRefMacro } from './parse_sql';
import { transformCodeToDbtRef, transformRefToFull, transformSmartSingleLine } from './transforms';
import './styles.scss';

type PanelPosition = { left: number; top: number };

export class PanelClass {
  private hostDoc: Document;
  private hostWin: Window;
  private root: HTMLElement;
  private dragHandle: HTMLElement;
  private toast: HTMLElement;

  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragMoved = false;

  /**
   * Sukuria tempiamą mygtukų panelę BigQuery SQL transformacijoms.
   */
  constructor(hostDoc: Document) {
    this.hostDoc = hostDoc;
    this.hostWin = hostDoc.defaultView ?? window;

    this.root = hostDoc.createElement('div');
    this.root.id = 'bq-tm-panel';
    this.root.className = 'bq-tm-panel';

    this.dragHandle = hostDoc.createElement('div');
    this.dragHandle.className = 'bq-tm-panel__handle';
    this.dragHandle.textContent = 'BQ';
    this.dragHandle.title = 'Tempkite panelę';

    this.toast = hostDoc.createElement('div');
    this.toast.className = 'bq-tm-panel__toast';

    const actions = hostDoc.createElement('div');
    actions.className = 'bq-tm-panel__actions';

    actions.appendChild(
      this.createActionButton('ref', 'code > ref', () => this.onCodeToRef()),
    );
    actions.appendChild(
      this.createActionButton('full', 'ref > full', () => this.onRefToFull()),
    );
    actions.appendChild(
      this.createActionButton('fmt', '1 eil. → format + filtras', () =>
        this.onSmartFormat(),
      ),
    );

    this.root.appendChild(this.dragHandle);
    this.root.appendChild(actions);
    this.root.appendChild(this.toast);

    this.applyInlineFallbackStyles();
    this.applyStoredPosition();
    this.bindDrag();

    hostDoc.body.appendChild(this.root);
  }

  /**
   * Minimalūs stiliai, jei SCSS neįsikrauna (pvz. tik @require be CSS).
   */
  private applyInlineFallbackStyles(): void {
    Object.assign(this.root.style, {
      position: 'fixed',
      zIndex: '2147483646',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '8px',
      borderRadius: '10px',
      background: '#1a1a2e',
      border: '1px solid #3d3d5c',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.45)',
      maxWidth: '220px',
    });
  }

  private createActionButton(
    cssMod: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = this.hostDoc.createElement('button');
    btn.type = 'button';
    btn.className = `bq-tm-panel__btn bq-tm-panel__btn--${cssMod}`;
    btn.textContent = label;
    btn.addEventListener('mousedown', event => {
      event.preventDefault();
    });
    btn.addEventListener('click', event => {
      event.stopPropagation();
      if (this.dragMoved) {
        this.dragMoved = false;
        return;
      }
      onClick();
    });
    return btn;
  }

  private applyStoredPosition(): void {
    const raw = localStorage.getItem(STORAGE_POSITION);
    if (!raw) {
      this.root.style.left = '16px';
      this.root.style.bottom = '16px';
      this.root.style.top = 'auto';
      return;
    }

    try {
      const pos = JSON.parse(raw) as PanelPosition;
      if (this.isPositionOnScreen(pos)) {
        this.root.style.left = `${pos.left}px`;
        this.root.style.top = `${pos.top}px`;
        this.root.style.bottom = 'auto';
        return;
      }
      localStorage.removeItem(STORAGE_POSITION);
    } catch {
      /* naudojame numatytąją poziciją */
    }

    this.setDefaultPosition();
  }

  /**
   * Numatyta pozicija — kairė apačia.
   */
  private setDefaultPosition(): void {
    this.root.style.left = '16px';
    this.root.style.bottom = '16px';
    this.root.style.top = 'auto';
  }

  /**
   * Patikrina, ar panelė matoma ekrane.
   */
  private isPositionOnScreen(pos: PanelPosition): boolean {
    const margin = 40;
    return (
      pos.left >= -margin &&
      pos.top >= -margin &&
      pos.left < this.hostWin.innerWidth - margin &&
      pos.top < this.hostWin.innerHeight - margin
    );
  }

  private storePosition(): void {
    const rect = this.root.getBoundingClientRect();
    const payload: PanelPosition = { left: rect.left, top: rect.top };
    localStorage.setItem(STORAGE_POSITION, JSON.stringify(payload));
  }

  private bindDrag(): void {
    this.dragHandle.addEventListener('mousedown', event => {
      event.preventDefault();
      this.dragging = true;
      this.dragMoved = false;
      const rect = this.root.getBoundingClientRect();
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;
      this.root.style.bottom = 'auto';
    });

    this.hostWin.addEventListener('mousemove', event => {
      if (!this.dragging) {
        return;
      }

      this.dragMoved = true;
      const left = event.clientX - this.dragOffsetX;
      const top = event.clientY - this.dragOffsetY;
      this.root.style.left = `${Math.max(0, left)}px`;
      this.root.style.top = `${Math.max(0, top)}px`;
    });

    this.hostWin.addEventListener('mouseup', () => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.storePosition();
    });
  }

  private showToast(message: string, isError = false): void {
    this.toast.textContent = message;
    this.toast.classList.toggle('bq-tm-panel__toast--error', isError);
    this.toast.classList.add('bq-tm-panel__toast--visible');

    this.hostWin.setTimeout(() => {
      this.toast.classList.remove('bq-tm-panel__toast--visible');
    }, 2800);
  }

  private async onCodeToRef(): Promise<void> {
    try {
      const sql = await readActiveEditorSql();
      const converted = transformCodeToDbtRef(sql);
      await copyToClipboard(converted);
      this.showToast('Nukopijuota (code → ref)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }

  private onRefToFull(): void {
    try {
      const { text, replaceWith } = getActiveEditorWriteContext();

      if (!containsDbtRefMacro(text)) {
        throw new Error('Pažymėtame tekste nėra {{ ref(...) }}.');
      }

      replaceWith(transformRefToFull(text));
      this.showToast('Atnaujinta (ref → full)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }

  private async onSmartFormat(): Promise<void> {
    try {
      const sql = await readActiveEditorSql();
      const { kind, sql: converted } = transformSmartSingleLine(sql);
      writeActiveEditorSql(converted);

      const label =
        kind === 'raw'
          ? 'raw → partition_date'
          : kind === 'stg'
            ? 'stg → scd_is_active'
            : 'formatuota (--limit 1000)';

      this.showToast(`Atnaujinta (${label})`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }
}
