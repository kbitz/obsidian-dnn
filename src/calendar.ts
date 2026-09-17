import { setIcon } from 'obsidian';
import { dateKey, dateMoment, monthCells, type DailyIndex, type MomentFactory } from './daily-notes';

export interface Picker { close: (restoreFocus?: boolean) => void; focus: () => void }
export interface PickerOptions {
  anchor: HTMLButtonElement;
  current: string;
  index: DailyIndex;
  moment: MomentFactory;
  locale: string;
  select: (date: string) => Promise<boolean>;
  closed: () => void;
}
const openPickers = new WeakMap<Document, Picker>();

export function openCalendar(options: PickerOptions): Picker {
  const { anchor, current, index, moment, locale } = options;
  const doc = anchor.ownerDocument;
  const win = anchor.win;
  openPickers.get(doc)?.close(false);
  const dialog = doc.body.createEl('dialog', { cls: 'dnn-calendar', attr: { 'aria-label': 'Choose an existing daily note' } });
  const controls = dialog.createDiv({ cls: 'dnn-month-controls' });
  const previous = controls.createEl('button', { attr: { type: 'button', 'aria-label': 'Previous month' } });
  setIcon(previous, 'chevron-left');
  const monthInput = controls.createEl('select', { attr: { 'aria-label': 'Month' } });
  for (let i = 0; i < 12; i++) monthInput.createEl('option', { value: String(i), text: dateMoment('2000-01-01', moment, locale).month(i).format('MMMM') });
  const yearInput = controls.createEl('input', { cls: 'dnn-year', attr: { type: 'text', inputmode: 'numeric', 'aria-label': 'Year', maxlength: '4' } });
  const next = controls.createEl('button', { attr: { type: 'button', 'aria-label': 'Next month' } });
  setIcon(next, 'chevron-right');
  const announcement = dialog.createDiv({ cls: 'dnn-sr-only', attr: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const message = dialog.createDiv({ cls: 'dnn-message', attr: { role: 'status' } });
  const grid = dialog.createDiv({ attr: { role: 'grid', 'aria-label': 'Daily notes' } });
  const footer = dialog.createDiv({ cls: 'dnn-calendar-footer' });
  const todayButton = footer.createEl('button', { text: 'Today', attr: { type: 'button' } });
  const closeButton = footer.createEl('button', { text: 'Close', attr: { type: 'button' } });
  const minYear = Number(index.dates[0]?.slice(0, 4) ?? current.slice(0, 4));
  const maxYear = Number(index.dates.at(-1)?.slice(0, 4) ?? current.slice(0, 4));
  let month = dateMoment(current, moment, locale).startOf('month');
  let focusKey = current;
  let closed = false;
  let pending = false;
  let outsideDown = false;
  let midnightTimer: number | undefined;
  let positionFrame: number | undefined;

  function focusDay() {
    grid.querySelector<HTMLButtonElement>(`[data-date="${focusKey}"]`)?.focus();
  }
  function position() {
    if (closed) return;
    const rect = anchor.getBoundingClientRect();
    const bounds = dialog.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - bounds.width / 2, win.innerWidth - bounds.width - 8));
    const below = rect.bottom + 6;
    const top = Math.max(8, Math.min(below + bounds.height > win.innerHeight - 8 ? rect.top - bounds.height - 6 : below, win.innerHeight - bounds.height - 8));
    dialog.style.setProperty('--dnn-left', `${left}px`);
    dialog.style.setProperty('--dnn-top', `${top}px`);
  }
  // Scroll/resize can fire many times per second; coalesce to one reposition per frame.
  function schedulePosition() {
    if (closed || positionFrame !== undefined) return;
    positionFrame = win.requestAnimationFrame(() => { positionFrame = undefined; position(); });
  }
  function render(moveFocus = false) {
    if (closed) return;
    grid.empty();
    monthInput.value = String(month.month());
    yearInput.value = String(month.year()).padStart(4, '0');
    previous.disabled = month.year() === minYear && month.month() === 0;
    next.disabled = month.year() === maxYear && month.month() === 11;
    const today = dateKey(moment());
    todayButton.disabled = pending || !index.byDate.has(today);
    const label = month.format('MMMM YYYY');
    grid.setAttribute('aria-label', `Daily notes, ${label}`);
    announcement.textContent = label;
    const headings = grid.createDiv({ cls: 'dnn-week', attr: { role: 'row' } });
    const weekday = month.clone().startOf('week');
    for (let i = 0; i < 7; i++) {
      headings.createDiv({ cls: 'dnn-weekday', text: weekday.format('dd'), attr: { role: 'columnheader', 'aria-label': weekday.format('dddd') } });
      weekday.add(1, 'day');
    }
    const cells = monthCells(dateKey(month), index, moment, locale);
    message.textContent = cells.some(cell => cell.inMonth && cell.exists) ? '' : 'No daily notes this month.';
    for (let row = 0; row < 6; row++) {
      const week = grid.createDiv({ cls: 'dnn-week', attr: { role: 'row' } });
      for (const cell of cells.slice(row * 7, row * 7 + 7)) {
        const wrapper = week.createDiv({ attr: { role: 'gridcell', 'aria-selected': String(cell.key === current) } });
        const button = wrapper.createEl('button', {
          cls: 'dnn-day', text: cell.day,
          attr: { type: 'button', 'data-date': cell.key, 'aria-label': `${cell.label}${cell.exists ? '' : ', no daily note'}`, 'aria-disabled': String(!cell.exists || pending), tabindex: cell.key === focusKey ? '0' : '-1' },
        });
        button.classList.toggle('dnn-other-month', !cell.inMonth);
        button.classList.toggle('dnn-selected', cell.key === current);
        if (cell.key === today) button.setAttribute('aria-current', 'date');
        button.addEventListener('click', () => { void activate(cell.key); });
        button.addEventListener('focus', () => {
          focusKey = cell.key;
          for (const candidate of grid.querySelectorAll<HTMLButtonElement>('.dnn-day')) candidate.tabIndex = candidate === button ? 0 : -1;
        });
      }
    }
    if (moveFocus) focusDay();
    position();
  }
  async function activate(key: string) {
    if (closed || pending || !index.byDate.has(key)) return;
    if (key === current) { picker.close(); return; }
    pending = true;
    render(true);
    try {
      if (await options.select(key)) picker.close(false);
    } finally {
      pending = false;
      if (!closed) render(true);
    }
  }
  function changeMonth(amount: number) {
    const target = month.clone().add(amount, 'month');
    if (target.year() < minYear || target.year() > maxYear) return;
    month = target;
    focusKey = dateKey(month);
    render();
  }
  function commitYear() {
    const year = Number(yearInput.value);
    if (!/^\d{4}$/.test(yearInput.value) || year < minYear || year > maxYear) {
      yearInput.setAttribute('aria-invalid', 'true');
      message.textContent = `Enter a year from ${minYear} to ${maxYear}.`;
      return;
    }
    yearInput.removeAttribute('aria-invalid');
    if (year === month.year()) {
      // No-op commit: resync the message (it may still show the just-cleared error)
      // without rebuilding the grid — callers rely on day buttons keeping identity here.
      message.textContent = monthCells(dateKey(month), index, moment, locale).some(cell => cell.inMonth && cell.exists) ? '' : 'No daily notes this month.';
      return;
    }
    month.year(year);
    focusKey = dateKey(month);
    render();
  }
  function onGridKey(event: KeyboardEvent) {
    if (!doc.activeElement?.matches('.dnn-day') || pending) return;
    const date = dateMoment(focusKey, moment, locale);
    switch (event.key) {
      case 'ArrowLeft': date.subtract(1, 'day'); break;
      case 'ArrowRight': date.add(1, 'day'); break;
      case 'ArrowUp': date.subtract(7, 'day'); break;
      case 'ArrowDown': date.add(7, 'day'); break;
      case 'Home': date.startOf('week'); break;
      case 'End': date.endOf('week'); break;
      case 'PageUp': date.subtract(1, event.shiftKey ? 'year' : 'month'); break;
      case 'PageDown': date.add(1, event.shiftKey ? 'year' : 'month'); break;
      case 'Enter': case ' ': event.preventDefault(); event.stopPropagation(); void activate(focusKey); return;
      default: return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (date.year() < minYear || date.year() > maxYear) return;
    focusKey = dateKey(date);
    month = date.startOf('month');
    render(true);
  }
  function isOutside(event: PointerEvent) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  const picker: Picker = {
    focus: () => { if (!closed) focusDay(); },
    close: (restoreFocus = true) => {
      if (closed) return;
      closed = true;
      if (midnightTimer !== undefined) win.clearTimeout(midnightTimer);
      if (positionFrame !== undefined) win.cancelAnimationFrame(positionFrame);
      win.removeEventListener('resize', schedulePosition);
      doc.removeEventListener('scroll', schedulePosition, true);
      if (dialog.open) dialog.close();
      dialog.remove();
      anchor.setAttribute('aria-expanded', 'false');
      if (openPickers.get(doc) === picker) openPickers.delete(doc);
      options.closed();
      if (restoreFocus && anchor.isConnected) anchor.focus();
    },
  };
  previous.addEventListener('click', () => changeMonth(-1));
  next.addEventListener('click', () => changeMonth(1));
  monthInput.addEventListener('change', () => { month.month(Number(monthInput.value)); focusKey = dateKey(month); render(); });
  yearInput.addEventListener('blur', commitYear);
  yearInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitYear(); } });
  todayButton.addEventListener('click', () => { void activate(dateKey(moment())); });
  closeButton.addEventListener('click', () => picker.close());
  dialog.addEventListener('keydown', onGridKey);
  dialog.addEventListener('cancel', event => { event.preventDefault(); picker.close(); });
  dialog.addEventListener('close', () => picker.close());
  dialog.addEventListener('pointerdown', event => { outsideDown = isOutside(event); });
  dialog.addEventListener('pointerup', event => { if (outsideDown && isOutside(event)) picker.close(); outsideDown = false; });
  win.addEventListener('resize', schedulePosition);
  doc.addEventListener('scroll', schedulePosition, true);
  openPickers.set(doc, picker);
  anchor.setAttribute('aria-expanded', 'true');
  const updateToday = () => {
    if (closed) return;
    render(grid.contains(doc.activeElement));
    const now = moment();
    midnightTimer = win.setTimeout(updateToday, now.clone().add(1, 'day').startOf('day').diff(now) + 50);
  };
  try { updateToday(); dialog.showModal(); focusDay(); position(); }
  catch (error) { picker.close(); throw error; }
  return picker;
}
