import { afterEach, describe, expect, it, vi } from 'vitest';
import moment from 'moment';
import { openCalendar, type Picker } from '../src/calendar';
import { buildIndex, recognizer } from '../src/daily-notes';
import { deferred } from './helpers';

let picker: Picker | undefined;
afterEach(() => picker?.close(false));
function calendar(keys = ['2020-02-29', '2024-02-29', '2026-09-14', '2026-09-16', '2026-09-18'], current = '2026-09-16') {
  const anchor = document.body.createEl('button');
  const settings = { folder: 'Journal', format: 'YYYY-MM-DD', locale: 'en' };
  const index = buildIndex(keys.map(key => `Journal/${key}.md`), recognizer(settings, moment));
  const select = vi.fn(async () => true);
  const closed = vi.fn();
  picker = openCalendar({ anchor, current, index, moment, locale: 'en', select, closed });
  return { anchor, select, closed, picker };
}
function day(key: string) { return document.querySelector<HTMLButtonElement>(`[data-date="${key}"]`)!; }
function key(value: string, shiftKey = false) {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }));
}

describe('calendar behavior', () => {
  it('starts at the current note with one keyboard stop and missing-date labels', () => {
    calendar();
    expect(document.querySelectorAll('.dnn-day')).toHaveLength(42);
    expect(document.activeElement).toBe(day('2026-09-16'));
    expect(document.querySelectorAll('.dnn-day[tabindex="0"]')).toHaveLength(1);
    expect(day('2026-09-15').getAttribute('aria-disabled')).toBe('true');
    expect(day('2026-09-15').getAttribute('aria-label')).toContain('no daily note');
    expect(day('2026-09-16').parentElement?.getAttribute('aria-selected')).toBe('true');
  });
  it('blocks missing-date activation through pointer, Enter, and Space', () => {
    const { select } = calendar();
    day('2026-09-15').click();
    day('2026-09-15').focus(); key('Enter'); key(' ');
    expect(select).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')?.open).toBe(true);
  });
  it('opens an existing note once and closes', async () => {
    const { select } = calendar();
    day('2026-09-14').click(); day('2026-09-14').click();
    await vi.waitFor(() => expect(document.querySelector('dialog')).toBeNull());
    expect(select).toHaveBeenCalledExactlyOnceWith('2026-09-14');
  });
  it('keeps the picker usable after selection is rejected', async () => {
    const { select } = calendar(); select.mockResolvedValueOnce(false);
    day('2026-09-14').click();
    await vi.waitFor(() => expect(day('2026-09-14').getAttribute('aria-disabled')).toBe('false'));
    expect(document.querySelector('dialog')?.open).toBe(true);
  });
  it('choosing the current note closes without navigation', () => {
    const { select, anchor } = calendar(); day('2026-09-16').click();
    expect(select).not.toHaveBeenCalled();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });
  it('supports grid arrows, week edges, and month/year jumps', () => {
    calendar();
    key('ArrowLeft'); expect(document.activeElement).toBe(day('2026-09-15'));
    key('ArrowUp'); expect(document.activeElement).toBe(day('2026-09-08'));
    key('Home'); expect(document.activeElement).toBe(day('2026-09-06'));
    key('End'); expect(document.activeElement).toBe(day('2026-09-12'));
    key('PageUp'); expect(document.activeElement).toBe(day('2026-08-12'));
    key('PageUp', true); expect(document.activeElement).toBe(day('2025-08-12'));
  });
  it('moves between months using the header control buttons', () => {
    calendar();
    const previous = document.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')!;
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!;
    previous.click();
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('August 2026');
    expect(document.querySelector<HTMLSelectElement>('[aria-label="Month"]')?.value).toBe('7');
    next.click(); next.click();
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('October 2026');
  });
  it('changes month from the month dropdown', () => {
    calendar();
    const select = document.querySelector<HTMLSelectElement>('[aria-label="Month"]')!;
    select.value = '0';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('January 2026');
    expect(document.querySelector<HTMLInputElement>('[aria-label="Year"]')?.value).toBe('2026');
  });
  it('clamps leap day when moving a year', () => {
    calendar(undefined, '2024-02-29'); key('PageUp', true);
    expect(document.activeElement).toBe(day('2023-02-28'));
  });
  it('cleans up when showModal throws', () => {
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('unsupported'); });
    expect(() => calendar()).toThrow('unsupported');
    expect(document.querySelector('dialog')).toBeNull();
  });
  it('does not replace day buttons when the committed year is unchanged', () => {
    calendar();
    const target = day('2026-09-14');
    const year = document.querySelector<HTMLInputElement>('[aria-label="Year"]')!;
    year.focus();
    year.dispatchEvent(new FocusEvent('blur'));
    expect(day('2026-09-14')).toBe(target);
  });
  it('rejects a 4-digit year outside the indexed range', () => {
    calendar();
    const year = document.querySelector<HTMLInputElement>('[aria-label="Year"]')!;
    year.focus();
    year.value = '2027';
    year.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(year.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('September 2026');
  });
  it('ignores grid keys while a selection is pending', async () => {
    const { select } = calendar();
    const hang = deferred();
    select.mockImplementationOnce(async () => { await hang.promise; return true; });
    day('2026-09-14').click();
    key('ArrowLeft');
    key('Enter');
    expect(select).toHaveBeenCalledTimes(1);
    expect(document.querySelector('dialog')?.open).toBe(true);
    hang.resolve();
  });
  it('does not clobber an in-progress year edit when a pending selection resolves', async () => {
    const { select } = calendar();
    const open = deferred();
    select.mockImplementationOnce(async () => { await open.promise; return false; });
    const year = document.querySelector<HTMLInputElement>('[aria-label="Year"]')!;
    day('2026-09-14').click();
    year.focus();
    year.value = '2020';
    open.resolve();
    await vi.waitFor(() => expect(day('2026-09-14').getAttribute('aria-disabled')).toBe('false'));
    expect(year.value).toBe('2020');
    expect(document.activeElement).toBe(year);
  });
  it('validates a year without interpreting input arrows as grid keys', () => {
    calendar();
    const year = document.querySelector<HTMLInputElement>('[aria-label="Year"]')!;
    year.focus(); year.value = '20'; key('Enter');
    expect(year.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('September 2026');
    year.value = '2020'; key('Enter'); key('ArrowLeft');
    expect(year.value).toBe('2020');
    expect(document.querySelector('[role="grid"]')?.getAttribute('aria-label')).toContain('September 2020');
    expect(document.querySelector('.dnn-message')?.textContent).toBe('No daily notes this month.');
  });
  it('bounds navigation to years with notes', () => {
    calendar(['2026-01-01'], '2026-01-01');
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Previous month"]')?.disabled).toBe(true);
    key('PageUp'); expect(document.activeElement).toBe(day('2026-01-01'));
  });
  it('falls back to the current year when the index has no daily notes', () => {
    calendar([], '2026-09-16');
    expect(document.querySelectorAll('.dnn-day[aria-disabled="true"]')).toHaveLength(42);
    expect(document.querySelector('.dnn-message')?.textContent).toBe('No daily notes this month.');
    expect(document.querySelector<HTMLButtonElement>('.dnn-calendar-footer button')?.disabled).toBe(true);
    const year = document.querySelector<HTMLInputElement>('[aria-label="Year"]')!;
    year.focus(); year.value = '2025';
    year.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(year.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('.dnn-message')?.textContent).toBe('Enter a year from 2026 to 2026.');
  });
  it('disables missing Today and cannot activate it', () => {
    vi.setSystemTime(new Date('2026-09-17T12:00:00'));
    const { select } = calendar();
    const today = document.querySelector<HTMLButtonElement>('.dnn-calendar-footer button')!;
    expect(today.disabled).toBe(true); today.click(); expect(select).not.toHaveBeenCalled();
  });
  it('handles cancel with one cleanup and focus restoration', () => {
    const { anchor, closed } = calendar();
    document.querySelector('dialog')?.dispatchEvent(new Event('cancel', { cancelable: true }));
    picker?.close();
    expect(closed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(anchor);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });
  it('closes when a pointer press and release both land outside the dialog', () => {
    const { closed } = calendar();
    const dialog = document.querySelector('dialog')!;
    dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, clientY: 500, bubbles: true, cancelable: true }));
    dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 500, clientY: 500, bubbles: true, cancelable: true }));
    expect(document.querySelector('dialog')).toBeNull();
    expect(closed).toHaveBeenCalledOnce();
  });
  it('does not close on a drag that presses outside but releases inside the dialog', () => {
    calendar();
    const dialog = document.querySelector('dialog')!;
    dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 500, clientY: 500, bubbles: true, cancelable: true }));
    dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    expect(document.querySelector('dialog')).not.toBeNull();
  });
  it('does not close when a press starts inside the dialog but releases outside', () => {
    calendar();
    const dialog = document.querySelector('dialog')!;
    dialog.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
    dialog.dispatchEvent(new PointerEvent('pointerup', { clientX: 500, clientY: 500, bubbles: true, cancelable: true }));
    expect(document.querySelector('dialog')).not.toBeNull();
  });
  it('allows only one picker per document and cleans up window listeners', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const first = calendar(); const second = calendar();
    expect(first.closed).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    second.picker.close();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
  it('coalesces repeated resize events into one reposition per frame', () => {
    calendar();
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('resize'));
    expect(frames).toHaveBeenCalledTimes(1);
    frames.mockRestore();
  });
  it('refreshes Today at midnight and cancels the timer on close', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-15T23:59:59'));
    const scheduled = vi.spyOn(window, 'setTimeout');
    const cleared = vi.spyOn(window, 'clearTimeout');
    calendar();
    expect(document.querySelector<HTMLButtonElement>('.dnn-calendar-footer button')?.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(1100);
    expect(document.querySelector<HTMLButtonElement>('.dnn-calendar-footer button')?.disabled).toBe(false);
    expect(day('2026-09-16').getAttribute('aria-current')).toBe('date');
    expect(document.activeElement).toBe(day('2026-09-16'));
    const midnight: unknown = scheduled.mock.results.at(-1)?.value;
    picker?.close();
    expect(cleared).toHaveBeenCalledWith(midnight);
    // jsdom schedules its own selectionchange after focus restoration.
    await vi.runOnlyPendingTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });
});
