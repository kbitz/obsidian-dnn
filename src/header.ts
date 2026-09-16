import { setIcon } from 'obsidian';

export interface HeaderState { date: string; previous?: string; next?: string; pending: boolean }
export interface HeaderActions { previous: () => void; next: () => void; picker: () => void }
export interface HeaderBinding {
  root: HTMLElement;
  dateButton: HTMLButtonElement;
  valid: () => boolean;
  update: (state: HeaderState) => void;
  dispose: () => void;
}

export function mountHeader(container: HTMLElement, state: HeaderState, actions: HeaderActions, changed: () => void): HeaderBinding | null {
  const header = container.querySelector<HTMLElement>(':scope > .view-header');
  const title = header?.querySelector<HTMLElement>('.view-header-title-container');
  const filename = title?.querySelector(':scope > .view-header-title');
  if (!title || !filename || !header) return null;
  // Only our marker hides native children. Removing it always restores Obsidian's nodes.
  if (title.querySelector(':scope > .dnn-nav')) return null;
  const root = title.createDiv({ cls: 'dnn-nav' });
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Daily note navigation');
  const previous = root.createEl('button', { cls: 'dnn-arrow', attr: { type: 'button', 'aria-label': 'Open previous daily note' } });
  setIcon(previous, 'chevron-left');
  const dateButton = root.createEl('button', { cls: 'dnn-date', attr: { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' } });
  const next = root.createEl('button', { cls: 'dnn-arrow', attr: { type: 'button', 'aria-label': 'Open next daily note' } });
  setIcon(next, 'chevron-right');
  previous.addEventListener('click', actions.previous);
  next.addEventListener('click', actions.next);
  dateButton.addEventListener('click', actions.picker);
  let disposed = false;
  const update = (value: HeaderState) => {
    dateButton.textContent = value.date;
    dateButton.setAttribute('aria-label', `Choose daily note date, ${value.date}`);
    previous.disabled = value.pending || !value.previous;
    next.disabled = value.pending || !value.next;
    dateButton.disabled = value.pending;
    previous.setAttribute('title', value.previous ? `Previous daily note: ${value.previous}` : 'No earlier daily note');
    next.setAttribute('title', value.next ? `Next daily note: ${value.next}` : 'No later daily note');
  };
  const valid = () => !disposed && root.isConnected && title.isConnected && root.parentElement === title
    && container.contains(title) && title.querySelector(':scope > .view-header-title') !== null;
  const Observer = container.ownerDocument.defaultView?.MutationObserver;
  if (!Observer) { root.remove(); return null; }
  const observer = new Observer(records => {
    if (records.every(record => root.contains(record.target))) return;
    if (!valid()) title.classList.remove('dnn-mounted');
    changed();
  });
  observer.observe(header, { childList: true, subtree: true });
  observer.observe(container, { childList: true });
  if (root.isConnected) title.classList.add('dnn-mounted');
  update(state);
  return {
    root, dateButton, valid, update,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      previous.removeEventListener('click', actions.previous);
      next.removeEventListener('click', actions.next);
      dateButton.removeEventListener('click', actions.picker);
      title.classList.remove('dnn-mounted');
      root.remove();
    },
  };
}
