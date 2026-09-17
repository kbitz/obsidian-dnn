import { afterEach, describe, expect, it } from 'vitest';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/ar';
import { buildIndex, dateKey, dateMoment, monthCells, neighbor, recognizer, settingsKey, validFormat } from '../src/daily-notes';

const settings = { folder: 'Journal', format: 'YYYY-MM-DD', locale: 'en' };
afterEach(() => moment.locale('en'));

describe('settings cache key', () => {
  it('is equal for equal settings and distinct when any field differs', () => {
    expect(settingsKey(settings)).toBe(settingsKey({ ...settings }));
    expect(settingsKey(settings)).not.toBe(settingsKey({ ...settings, folder: 'Other' }));
    expect(settingsKey(settings)).not.toBe(settingsKey({ ...settings, format: 'YYYY/MM/DD' }));
    expect(settingsKey(settings)).not.toBe(settingsKey({ ...settings, locale: 'fr' }));
  });
});

describe('full-path daily note recognition', () => {
  it.each([
    ['Journal/2024-02-29.md', '2024-02-29'],
    ['Journal/2023-02-29.md', null], ['Journal/2026-02-30.md', null],
    ['Journal/2026-9-16.md', null], ['Journal/2026-09-16.txt', null],
    ['Journal Archive/2026-09-16.md', null], ['2026-09-16.md', null],
    ['Journal/nested/2026-09-16.md', null], ['Journal/notes.md', null],
  ])('%s recognizes as %s', (path, key) => expect(recognizer(settings, moment)(path)).toBe(key));

  it('supports root configuration without treating all date-like basenames as notes', () => {
    const parse = recognizer({ ...settings, folder: '' }, moment);
    expect(parse('2026-09-16.md')).toBe('2026-09-16');
    expect(parse('Other/2026-09-16.md')).toBeNull();
  });
  it.each([
    ['YYYY/MMMM/YYYY-MM-DD', '2026/September/2026-09-16', '2026-09-16'],
    ['YYYY/MMMM/YYYY-MM-DD', '2025/September/2026-09-16', null],
    ['YYYY-DDD', '2026-259', '2026-09-16'],
    ['GGGG-[W]WW-E', '2026-W38-3', '2026-09-16'],
    ['YYYY-[day]-DDDD', '2024-day-060', '2024-02-29'],
    ['[Day] YYYY-MM-DD', 'Day 2026-09-16', '2026-09-16'],
    ['YYYY-MM-DD dddd', '2026-09-16 Wednesday', '2026-09-16'],
    ['YYYY-MM-DD dddd', '2026-09-16 Friday', null],
  ])('round-trips %s', (format, path, expected) => expect(recognizer({ ...settings, format }, moment)(`Journal/${path}.md`)).toBe(expected));

  it.each(['MM-DD', 'YY-MM-DD', 'YYYY-MM', 'YYYY', 'YYYY-MM-DD HH:mm', 'X', 'GGGG-WW', '[YYYY]-MM-DD', 'LTS', 'LLL', 'YYYY-MM-DD[', 'YYYY-MM-DD\\'])('rejects incomplete/time format %s', format => expect(validFormat(format, moment, 'en')).toBe(false));
  it.each(['YYYY-Mo-DD', 'YYYY-DDDo', 'GGGG-[W]Wo-E'])('rejects %s: Moment formats its ordinal suffix but cannot strictly parse it back', format => expect(validFormat(format, moment, 'en')).toBe(false));
  it('throws instead of inferring the current year from an incomplete format', () => {
    expect(() => recognizer({ folder: 'Journal', format: 'MM-DD', locale: 'en' }, moment)).toThrow(/complete date format/);
  });
  it.each(['YYYY-MM-DD', 'YYYY-M-D', 'YYYY-MM-Do', 'YYYY-DDD', 'GGGG-[W]WW-E', 'L', 'LL', 'll', '[literal] YYYY-MM-DD'])('accepts complete format %s', format => expect(validFormat(format, moment, 'en')).toBe(true));
  it('parses localized names and keeps internal keys in ASCII', () => {
    expect(recognizer({ ...settings, format: 'LL', locale: 'fr' }, moment)('Journal/16 septembre 2026.md')).toBe('2026-09-16');
    expect(recognizer({ ...settings, format: 'LL', locale: 'fr' }, moment)('Journal/16 septembre 2026.md'.normalize('NFD'))).toBe('2026-09-16');
    const path = moment('2026-09-16', 'YYYY-MM-DD', 'en', true).locale('ar').format('YYYY-MM-DD');
    expect(recognizer({ ...settings, locale: 'ar' }, moment)(`Journal/${path}.md`)).toBe('2026-09-16');
    expect(dateKey(dateMoment('2026-09-16', moment, 'ar'))).toBe('2026-09-16');
  });
  it('does not shift dates through timezone or DST conversions', () => {
    for (const key of ['2026-03-08', '2026-11-01', '2024-02-29']) expect(dateKey(dateMoment(key, moment, 'en'))).toBe(key);
  });
});

describe('chronological index and calendar model', () => {
  it('skips gaps, sorts and stops at boundaries', () => {
    const index = buildIndex(['Journal/2026-09-18.md', 'Journal/2026-09-14.md', 'Journal/2026-09-16.md'], recognizer(settings, moment));
    expect(neighbor(index, '2026-09-16', -1)).toBe('2026-09-14');
    expect(neighbor(index, '2026-09-16', 1)).toBe('2026-09-18');
    expect(neighbor(index, '2026-09-14', -1)).toBeUndefined();
    expect(neighbor(index, '2026-09-18', 1)).toBeUndefined();
  });
  it('handles empty and singleton histories', () => {
    const empty = buildIndex([], recognizer(settings, moment));
    expect(neighbor(empty, '2026-09-16', 1)).toBeUndefined();
    const single = buildIndex(['Journal/2026-09-16.md'], recognizer(settings, moment));
    expect(neighbor(single, '2026-09-16', -1)).toBeUndefined();
    expect(neighbor(single, '2026-09-16', 1)).toBeUndefined();
  });
  it('deduplicates a repeated path instead of treating it as a collision', () => {
    const index = buildIndex(['Journal/2026-09-16.md', 'Journal/2026-09-16.md'], recognizer(settings, moment));
    expect(index.dates).toEqual(['2026-09-16']);
    expect(index.byPath.size).toBe(1);
    expect(index.ambiguous.size).toBe(0);
  });
  it('fails closed on ambiguous keys and ignores repeated identical paths', () => {
    const index = buildIndex(['a', 'a', 'b'], () => '2026-09-16');
    expect(index.dates).toEqual([]);
    expect(index.byPath.size).toBe(0);
    expect(index.ambiguous.has('2026-09-16')).toBe(true);
  });
  it('does not revive a date after a third colliding path', () => {
    const index = buildIndex(['a.md', 'b.md', 'c.md'], () => '2026-09-16');
    expect(index.dates).toEqual([]);
    expect(index.byPath.size).toBe(0);
    expect(index.ambiguous.has('2026-09-16')).toBe(true);
  });
  it('renders a bounded month with leap day and locale week ordering', () => {
    const index = buildIndex(['Journal/2024-02-29.md'], recognizer(settings, moment));
    const cells = monthCells('2024-02-01', index, moment, 'en');
    expect(cells).toHaveLength(42);
    expect(cells.filter(cell => cell.exists).map(cell => cell.key)).toEqual(['2024-02-29']);
    expect(cells[0]?.key).toBe('2024-01-28');
    expect(monthCells('2024-02-01', index, moment, 'fr')[0]?.key).toBe('2024-01-29');
  });
  it('indexes a 10,000-note history', () => {
    const day = moment('1990-01-01', 'YYYY-MM-DD', 'en', true);
    const paths = Array.from({ length: 10_000 }, () => { const path = `Journal/${day.format('YYYY-MM-DD')}.md`; day.add(1, 'day'); return path; });
    const index = buildIndex(paths, recognizer(settings, moment));
    expect(index.dates).toHaveLength(10_000);
    expect(neighbor(index, index.dates[5000]!, -1)).toBe(index.dates[4999]);
  });
});
