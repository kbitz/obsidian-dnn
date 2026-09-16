import type moment from 'moment';

export type MomentFactory = typeof moment;
export interface DailySettings { folder: string; format: string; locale: string }
export interface DailyIndex {
  byDate: Map<string, string>;
  byPath: Map<string, string>;
  dates: string[];
  ambiguous: Set<string>;
}
export type NavigationIntent = { direction: -1 | 1 } | { date: string };

// Bracketed literals and escaped characters are never interpreted as date tokens.
const tokens = ['YYYY', 'GGGG', 'MMMM', 'MMM', 'MM', 'Mo', 'M', 'DDDo', 'DDDD', 'DDD', 'DD', 'Do', 'D', 'WW', 'Wo', 'W', 'E', 'dddd', 'ddd', 'dd', 'do', 'd'];

export function validFormat(format: string, factory: MomentFactory, locale: string): boolean {
  let expanded = format;
  const data = factory.localeData(locale);
  for (let count = 0; count < 6; count++) {
    const next = expanded.replace(/\[[^\]]*\]|\\.|LTS|LT|L{1,4}|l{1,4}/g, part => {
      if (part.startsWith('[') || part.startsWith('\\')) return part;
      return data.longDateFormat(part as moment.LongDateFormatKey) || part;
    });
    if (next === expanded) break;
    expanded = next;
  }
  const seen = new Set<string>();
  for (let pos = 0; pos < expanded.length;) {
    const char = expanded[pos];
    if (char === '[') {
      const end = expanded.indexOf(']', pos + 1);
      if (end < 0) return false;
      pos = end + 1;
    } else if (char === '\\') {
      if (pos + 1 >= expanded.length) return false;
      pos += 2;
    } else {
      const token = tokens.find(value => expanded.startsWith(value, pos));
      if (token) { seen.add(token); pos += token.length; }
      else {
        if (!char || /[A-Za-z[\]]/.test(char)) return false;
        pos++;
      }
    }
  }
  const has = (...values: string[]) => values.some(value => seen.has(value));
  return (seen.has('YYYY') && ((has('M', 'MM', 'MMM', 'MMMM', 'Mo') && has('D', 'DD', 'Do')) || has('DDD', 'DDDD', 'DDDo')))
    || (seen.has('GGGG') && has('W', 'WW', 'Wo') && seen.has('E'));
}

export function dateKey(value: moment.Moment): string {
  return `${String(value.year()).padStart(4, '0')}-${String(value.month() + 1).padStart(2, '0')}-${String(value.date()).padStart(2, '0')}`;
}

export function dateMoment(key: string, factory: MomentFactory, locale: string): moment.Moment {
  // Internal ASCII keys must not pass through the user's locale preparse hook.
  return factory(key, 'YYYY-MM-DD', 'en', true).locale(locale);
}

export function recognizer(settings: DailySettings, factory: MomentFactory): (path: string) => string | null {
  if (!validFormat(settings.format, factory, settings.locale)) throw new Error('Daily notes needs a complete date format with a four-digit year and no time of day.');
  const prefix = settings.folder ? `${settings.folder}/` : '';
  return path => {
    if (!path.startsWith(prefix) || !path.endsWith('.md')) return null;
    const relative = path.slice(prefix.length, -3);
    const parsed = factory(relative, settings.format, settings.locale, true);
    if (!parsed.isValid() || parsed.year() < 0 || parsed.year() > 9999 || parsed.format(settings.format).normalize('NFC') !== relative.normalize('NFC')) return null;
    return dateKey(parsed);
  };
}

export function buildIndex(paths: Iterable<string>, recognize: (path: string) => string | null): DailyIndex {
  const byDate = new Map<string, string>();
  const byPath = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const path of new Set(paths)) {
    const key = recognize(path);
    if (!key || ambiguous.has(key)) continue;
    const prior = byDate.get(key);
    if (prior) {
      byPath.delete(prior);
      byDate.delete(key);
      ambiguous.add(key);
    } else {
      byDate.set(key, path);
      byPath.set(path, key);
    }
  }
  return { byDate, byPath, ambiguous, dates: [...byDate.keys()].sort() };
}

export function neighbor(index: DailyIndex, key: string, direction: -1 | 1): string | undefined {
  let low = 0;
  let high = index.dates.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (index.dates[middle]! < key) low = middle + 1;
    else high = middle;
  }
  return index.dates[direction === -1 ? low - 1 : low + (index.dates[low] === key ? 1 : 0)];
}

export interface MonthCell { key: string; day: string; inMonth: boolean; exists: boolean; label: string }
export function monthCells(month: string, index: DailyIndex, factory: MomentFactory, locale: string): MonthCell[] {
  const first = dateMoment(month, factory, locale).startOf('month');
  const cursor = first.clone().startOf('week');
  return Array.from({ length: 42 }, () => {
    const key = dateKey(cursor);
    const cell = { key, day: cursor.format('D'), inMonth: cursor.month() === first.month(), exists: index.byDate.has(key), label: cursor.format('dddd, LL') };
    cursor.add(1, 'day');
    return cell;
  });
}

export function settingsKey(settings: DailySettings): string {
  return JSON.stringify([settings.folder, settings.format, settings.locale]);
}
