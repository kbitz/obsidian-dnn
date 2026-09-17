import moment from 'moment';
import { vi } from 'vitest';
export { moment };
export const notices: string[] = [];
export class Notice { constructor(message: string) { notices.push(message); } }
export function normalizePath(path: string): string { return path.normalize().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+|\/+$/g, ''); }
export function setIcon(element: HTMLElement, icon: string) { element.setAttribute('data-icon', icon); }
export class TFile {
  extension = 'md';
  constructor(public path: string) { this.extension = path.split('.').at(-1) ?? ''; }
}
export class TFolder {
  children: (TFile | TFolder)[] = [];
  constructor(public path: string) {}
}
export class Events {
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  on(name: string, callback: (...args: unknown[]) => void) {
    const handlers = this.handlers.get(name) ?? new Set(); handlers.add(callback); this.handlers.set(name, handlers);
    return { off: () => handlers.delete(callback) };
  }
  trigger(name: string, ...args: unknown[]) { for (const callback of this.handlers.get(name) ?? []) callback(...args); }
}
export class Vault extends Events {
  root = new TFolder('');
  files = new Map<string, TFile | TFolder>();
  constructor(paths: string[]) { super(); for (const path of paths) this.add(path); }
  add(path: string) {
    const parts = path.split('/'); let parent = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPath = parts.slice(0, i + 1).join('/');
      let folder = this.files.get(folderPath);
      if (!(folder instanceof TFolder)) { folder = new TFolder(folderPath); parent.children.push(folder); this.files.set(folderPath, folder); }
      parent = folder;
    }
    const file = new TFile(path); parent.children.push(file); this.files.set(path, file); this.trigger('create', file); return file;
  }
  remove(path: string) {
    const file = this.files.get(path);
    this.files.delete(path);
    for (const folder of [this.root, ...this.files.values()]) if (folder instanceof TFolder) folder.children = folder.children.filter(child => child !== file);
    this.trigger('delete', file);
  }
  getAbstractFileByPath(path: string) { return this.files.get(path) ?? null; }
  getRoot() { return this.root; }
}
export class MarkdownView {
  containerEl: HTMLElement;
  leaf!: WorkspaceLeaf;
  constructor(public file: TFile | null) {
    this.containerEl = document.body.createDiv();
    const header = this.containerEl.createDiv({ cls: 'view-header' });
    header.createDiv({ cls: 'view-header-left', text: 'History' });
    const title = header.createDiv({ cls: 'view-header-title-container' });
    title.createDiv({ cls: 'view-header-title-parent', text: 'Journal /' });
    title.createDiv({ cls: 'view-header-title', text: file?.path });
    header.createDiv({ cls: 'view-actions', text: 'Actions' });
  }
}
export class WorkspaceLeaf {
  isDeferred = false;
  pinned = false;
  openFile = vi.fn(async (file: TFile) => { this.view.file = file; this.workspace.trigger('file-open', file); });
  constructor(public view: MarkdownView, public workspace: Workspace) { view.leaf = this; }
}
export class Workspace extends Events {
  leaves: WorkspaceLeaf[] = [];
  active: WorkspaceLeaf | null = null;
  onLayoutReady(callback: () => void) { callback(); }
  getLeavesOfType() { return this.leaves; }
  getActiveViewOfType() { return this.active?.view ?? null; }
  add(file: TFile) { const leaf = new WorkspaceLeaf(new MarkdownView(file), this); this.leaves.push(leaf); this.active = leaf; return leaf; }
}
export class App {
  workspace = new Workspace();
  internalPlugins = { plugins: { 'daily-notes': { enabled: true, instance: { options: { folder: 'Journal', format: 'YYYY-MM-DD' } } } } };
  constructor(public vault: Vault) {}
}
export interface Command { id: string; name: string; hotkeys?: unknown[]; checkCallback: (checking: boolean) => boolean }
export class Plugin {
  commands: Command[] = [];
  cleanups: (() => void)[] = [];
  constructor(public app: App) {}
  addCommand(command: Command) { this.commands.push(command); return command; }
  registerEvent(event: { off: () => void }) { this.cleanups.push(event.off); }
  onunload() {}
  unload() { this.onunload(); for (const callback of this.cleanups) callback(); this.commands = []; }
}
