import { STORAGE_POSITION } from '../constants';
import {
  copyToClipboard,
  readActiveEditorSql,
  writeActiveEditorSql,
} from './editor';
import {
  transformToDbtRef,
  transformToLowerWithPartition,
  transformToScdActiveLow,
} from './transforms';
import './styles.scss';

type PanelPosition = { left: number; top: number };

export class PanelClass {
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
  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'bq-tm-panel';
    this.root.className = 'bq-tm-panel';

    this.dragHandle = document.createElement('div');
    this.dragHandle.className = 'bq-tm-panel__handle';
    this.dragHandle.textContent = 'BQ';
    this.dragHandle.title = 'Tempkite panelę';

    this.toast = document.createElement('div');
    this.toast.className = 'bq-tm-panel__toast';

    const actions = document.createElement('div');
    actions.className = 'bq-tm-panel__actions';

    actions.appendChild(
      this.createActionButton('ref', 'dbt ref → clipboard', () =>
        this.onDbtRef(),
      ),
    );
    actions.appendChild(
      this.createActionButton('low', 'low + partition', () =>
        this.onLowerPartition(),
      ),
    );
    actions.appendChild(
      this.createActionButton('scd', 'scd active low', () => this.onScdLow()),
    );

    this.root.appendChild(this.dragHandle);
    this.root.appendChild(actions);
    this.root.appendChild(this.toast);

    this.applyStoredPosition();
    this.bindDrag();

    document.body.appendChild(this.root);
  }

  private createActionButton(
    cssMod: string,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bq-tm-panel__btn bq-tm-panel__btn--${cssMod}`;
    btn.textContent = label;
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
      this.root.style.left = `${pos.left}px`;
      this.root.style.top = `${pos.top}px`;
      this.root.style.bottom = 'auto';
    } catch {
      this.root.style.left = '16px';
      this.root.style.bottom = '16px';
    }
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

    document.addEventListener('mousemove', event => {
      if (!this.dragging) {
        return;
      }

      this.dragMoved = true;
      const left = event.clientX - this.dragOffsetX;
      const top = event.clientY - this.dragOffsetY;
      this.root.style.left = `${Math.max(0, left)}px`;
      this.root.style.top = `${Math.max(0, top)}px`;
    });

    document.addEventListener('mouseup', () => {
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

    window.setTimeout(() => {
      this.toast.classList.remove('bq-tm-panel__toast--visible');
    }, 2800);
  }

  private async onDbtRef(): Promise<void> {
    try {
      const sql = readActiveEditorSql();
      const converted = transformToDbtRef(sql);
      await copyToClipboard(converted);
      this.showToast('Nukopijuota (dbt ref)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }

  private onLowerPartition(): void {
    try {
      const sql = readActiveEditorSql();
      const converted = transformToLowerWithPartition(sql);
      writeActiveEditorSql(converted);
      this.showToast('Atnaujinta (low + partition)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }

  private onScdLow(): void {
    try {
      const sql = readActiveEditorSql();
      const converted = transformToScdActiveLow(sql);
      writeActiveEditorSql(converted);
      this.showToast('Atnaujinta (scd active)');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nežinoma klaida';
      this.showToast(message, true);
    }
  }
}
