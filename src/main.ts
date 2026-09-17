import { MarkdownView, Notice, Plugin, TFile, TFolder, moment, normalizePath, type App, type WorkspaceLeaf } from 'obsidian';
import { buildIndex, dateKey, neighbor, recognizer, settingsKey, type DailyIndex, type DailySettings, type MomentFactory, type NavigationIntent } from './daily-notes';
import { mountHeader, type HeaderBinding, type HeaderState } from './header';
import { openCalendar, type Picker } from './calendar';

// Obsidian 1.8 API declarations describe Moment as a namespace; the runtime export is callable.
const dateFactory = moment as unknown as MomentFactory;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}
export function readDailySettings(app: App, factory: MomentFactory): DailySettings {
  // The only core-plugin compatibility boundary; nothing outside this function knows its shape.
  const internal = record((app as unknown as { internalPlugins?: unknown }).internalPlugins);
  const entry = record(record(internal?.plugins)?.['daily-notes']);
  if (entry?.enabled !== true) throw new Error('Enable the core Daily notes plugin to browse daily notes.');
  const instance = record(entry.instance);
  if (!instance) throw new Error('Daily notes settings are unavailable in this app version.');
  const options = instance.options === undefined ? {} : record(instance.options);
  if (!options || (options.folder !== undefined && typeof options.folder !== 'string') || (options.format !== undefined && typeof options.format !== 'string')) {
    throw new Error('Daily notes settings could not be read.');
  }
  return {
    folder: normalizePath(typeof options.folder === 'string' ? options.folder : '').replace(/^\/$/, ''),
    format: typeof options.format === 'string' && options.format ? options.format : 'YYYY-MM-DD',
    locale: factory.locale(),
  };
}

interface Pane {
  leaf: WorkspaceLeaf;
  view: MarkdownView;
  path: string;
  key: string;
  header: HeaderBinding;
  pending: boolean;
  picker?: Picker;
}
interface Snapshot { settings: DailySettings; key: string; index: DailyIndex }

export default class DailyNoteNavigation extends Plugin {
  private panes = new Map<WorkspaceLeaf, Pane>();
  private snapshot: Snapshot | null = null;
  private dirty = true;
  private ready = false;
  private disposed = false;
  private frame: { win: Window; id: number; timer: number } | null = null;
  private inflight = new WeakSet<WorkspaceLeaf>();
  private lastProblem = '';

  onload(): void {
    if (typeof moment !== 'function') { this.problem('The app date library is unavailable.'); return; }
    this.addCommand({ id: 'open-date-picker', name: 'Open date picker', checkCallback: checking => {
      const pane = this.activePane();
      if (!pane || !this.visible(pane.header.dateButton)) return false;
      if (!checking) this.showPicker(pane);
      return true;
    } });
    this.addCommand({ id: 'open-existing-today', name: "Open today's existing daily note", checkCallback: checking => {
      const pane = this.activePane();
      const today = dateKey(dateFactory());
      if (!pane || !this.snapshot?.index.byDate.has(today)) return false;
      if (!checking) void this.navigate(pane, { date: today });
      return true;
    } });
    this.app.workspace.onLayoutReady(() => {
      if (this.disposed) return;
      this.ready = true;
      // startup -> snapshot/index -> per-pane bindings; file events only dirty the index.
      const changed = () => { this.dirty = true; this.schedule(); };
      this.registerEvent(this.app.vault.on('create', changed));
      this.registerEvent(this.app.vault.on('delete', changed));
      this.registerEvent(this.app.vault.on('rename', changed));
      this.registerEvent(this.app.workspace.on('file-open', () => this.schedule()));
      this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.schedule()));
      this.registerEvent(this.app.workspace.on('layout-change', () => this.schedule()));
      this.registerEvent(this.app.workspace.on('css-change', () => this.schedule()));
      this.registerEvent(this.app.workspace.on('window-open', () => this.schedule()));
      this.registerEvent(this.app.workspace.on('window-close', () => {
        // A closing pop-out may never run its queued animation frame.
        this.cancelScheduled();
        this.schedule();
      }));
      this.reconcile();
    });
  }

  onunload(): void {
    this.disposed = true;
    this.cancelScheduled();
    this.clearPanes();
    this.snapshot = null;
  }

  private schedule(win: Window = window): void {
    if (this.disposed || this.frame) return;
    const flush = () => { this.cancelScheduled(); this.reconcile(); };
    // Occluded Electron windows suspend animation frames, including a main window
    // behind a pop-out. One event-driven fallback keeps those panes up to date.
    this.frame = { win, id: win.requestAnimationFrame(flush), timer: win.setTimeout(flush, 50) };
  }

  private cancelScheduled(): void {
    if (!this.frame) return;
    this.frame.win.cancelAnimationFrame(this.frame.id);
    this.frame.win.clearTimeout(this.frame.timer);
    this.frame = null;
  }

  private problem(message: string): void {
    if (message !== this.lastProblem) new Notice(message);
    this.lastProblem = message;
  }

  private refresh(): Snapshot | null {
    if (!this.ready || this.disposed) return null;
    try {
      const settings = readDailySettings(this.app, dateFactory);
      const key = settingsKey(settings);
      const folder = settings.folder ? this.app.vault.getAbstractFileByPath(settings.folder) : this.app.vault.getRoot();
      if (!(folder instanceof TFolder)) throw new Error('The configured Daily notes folder is unavailable.');
      const recognize = recognizer(settings, dateFactory);
      if (this.snapshot?.key !== key) {
        this.clearPanes();
        this.dirty = true;
      }
      if (this.dirty || !this.snapshot) {
        this.dirty = false;
        const paths: string[] = [];
        const stack = [folder];
        while (stack.length) {
          for (const file of stack.pop()!.children) {
            if (file instanceof TFolder) stack.push(file);
            else if (file instanceof TFile && file.extension === 'md') paths.push(file.path);
          }
        }
        const index = buildIndex(paths, recognize);
        // An open picker owns a snapshot. Close it rather than leaving stale selectable dates.
        for (const pane of this.panes.values()) pane.picker?.close(false);
        this.snapshot = { settings, key, index };
        if (index.ambiguous.size) this.problem('Some daily note dates are ambiguous and cannot be browsed.');
        else this.lastProblem = '';
      }
      return this.snapshot;
    } catch (error) {
      this.clearPanes();
      this.snapshot = null;
      this.problem(error instanceof Error ? error.message : 'Daily note navigation is unavailable.');
      return null;
    }
  }

  private state(pane: Pick<Pane, 'pending'>, date: string, snapshot: Snapshot): HeaderState {
    return { date, previous: neighbor(snapshot.index, date, -1), next: neighbor(snapshot.index, date, 1), pending: pane.pending };
  }

  private reconcile(): void {
    const snapshot = this.refresh();
    if (!snapshot) return;
    const leaves = new Set(this.app.workspace.getLeavesOfType('markdown'));
    for (const [leaf, pane] of this.panes) {
      if (!leaves.has(leaf) || leaf.view !== pane.view || pane.view.file?.path !== pane.path || pane.header.root.ownerDocument !== pane.view.containerEl.ownerDocument || !snapshot.index.byPath.has(pane.path) || !pane.header.valid()) this.disposePane(pane);
    }
    for (const leaf of leaves) {
      if (leaf.isDeferred || !(leaf.view instanceof MarkdownView) || !leaf.view.file || !snapshot.index.byPath.has(leaf.view.file.path)) continue;
      const existing = this.panes.get(leaf);
      // The disposal loop above already removed any pane whose path fell out of the index.
      if (existing) { existing.header.update(this.state(existing, snapshot.index.byPath.get(existing.path)!, snapshot)); continue; }
      const view = leaf.view;
      const path = view.file!.path;
      const pending = this.inflight.has(leaf);
      const actions = {
        previous: () => { const pane = this.panes.get(leaf); if (pane) void this.navigate(pane, { direction: -1 }); },
        next: () => { const pane = this.panes.get(leaf); if (pane) void this.navigate(pane, { direction: 1 }); },
        picker: () => { const pane = this.panes.get(leaf); if (pane) this.showPicker(pane); },
      };
      const header = mountHeader(view.containerEl, this.state({ pending }, snapshot.index.byPath.get(path)!, snapshot), actions, () => this.schedule(view.containerEl.win));
      if (header) this.panes.set(leaf, { leaf, view, path, header, key: snapshot.key, pending });
    }
  }

  private disposePane(pane: Pane): void {
    if (this.panes.get(pane.leaf) === pane) this.panes.delete(pane.leaf);
    pane.picker?.close(false);
    pane.header.dispose();
  }
  private clearPanes(): void { for (const pane of this.panes.values()) this.disposePane(pane); }
  private current(pane: Pane): boolean {
    return !this.disposed && this.panes.get(pane.leaf) === pane && pane.leaf.view === pane.view && pane.view.file?.path === pane.path && pane.header.valid();
  }
  private activePane(): Pane | undefined {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const pane = this.panes.get(view.leaf);
    return pane && !pane.pending && this.current(pane) ? pane : undefined;
  }
  private visible(element: HTMLElement): boolean { return element.isConnected && element.getClientRects().length > 0; }

  private showPicker(pane: Pane): void {
    const snapshot = this.refresh();
    if (!snapshot || pane.pending || !this.current(pane) || !this.visible(pane.header.dateButton)) { this.reconcile(); return; }
    if (pane.picker) { pane.picker.focus(); return; }
    const date = snapshot.index.byPath.get(pane.path);
    if (!date) return;
    try {
      pane.picker = openCalendar({
        anchor: pane.header.dateButton, current: date, index: snapshot.index, moment: dateFactory, locale: snapshot.settings.locale,
        select: key => this.navigate(pane, { date: key }, true),
        closed: () => { pane.picker = undefined; },
      });
    } catch (error) {
      console.error('Daily Note Navigation: failed to open the date picker', error);
      this.problem('The daily note date picker could not open in this window.');
    }
  }

  private async navigate(pane: Pane, intent: NavigationIntent, fromPicker = false): Promise<boolean> {
    if (!this.current(pane) || pane.pending || this.inflight.has(pane.leaf)) return false;
    // intent + live settings/index + originating pane -> validated TFile -> direct open
    const snapshot = this.refresh();
    if (!snapshot || snapshot.key !== pane.key || !this.current(pane)) { this.reconcile(); return false; }
    const currentDate = snapshot.index.byPath.get(pane.path);
    const targetDate = 'date' in intent ? intent.date : currentDate ? neighbor(snapshot.index, currentDate, intent.direction) : undefined;
    const path = targetDate ? snapshot.index.byDate.get(targetDate) : undefined;
    if (!path) { if ('date' in intent) this.problem('Daily note is no longer available.'); this.reconcile(); return false; }
    const target = this.app.vault.getAbstractFileByPath(path);
    if (!(target instanceof TFile) || recognizer(snapshot.settings, dateFactory)(target.path) !== targetDate) {
      this.dirty = true;
      this.problem('Daily note is no longer available.');
      this.reconcile();
      return false;
    }
    if (path === pane.path) return true;
    this.inflight.add(pane.leaf);
    pane.pending = true;
    // currentDate can be missing if pane.path just fell out of the index (e.g. became
    // ambiguous) between the guards above and here; skip the interim update rather than
    // rendering an undefined date, reconcile() below repairs the header once settled.
    if (currentDate) pane.header.update(this.state(pane, currentDate, snapshot));
    let opened = false;
    try {
      await pane.leaf.openFile(target);
      opened = pane.leaf.view instanceof MarkdownView && pane.leaf.view.file?.path === path;
      return opened;
    } catch (error) {
      console.error('Daily Note Navigation: failed to open', path, error);
      this.problem('Could not open the daily note. Please try again.');
      return false;
    } finally {
      this.inflight.delete(pane.leaf);
      const current = this.panes.get(pane.leaf);
      if (current) current.pending = false;
      this.reconcile();
      if (opened) {
        const updated = this.panes.get(pane.leaf);
        if (fromPicker) updated?.header.dateButton.focus();
        else if (updated && 'direction' in intent) {
          const arrow = intent.direction < 0 ? updated.header.previousButton : updated.header.nextButton;
          (arrow.disabled ? updated.header.dateButton : arrow).focus();
        }
      }
    }
  }
}
