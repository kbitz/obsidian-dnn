import { vi } from 'vitest';
import type { App as ObsidianApp, PluginManifest } from 'obsidian';
import DailyNoteNavigation from '../src/main';
import { App, Plugin, TFile, Vault } from './obsidian';

export const dates = ['Journal/2024-02-29.md', 'Journal/2026-09-14.md', 'Journal/2026-09-16.md', 'Journal/2026-09-18.md', 'Ordinary.md'];
export function fixture(paths = dates, active = 'Journal/2026-09-16.md') {
  const app = new App(new Vault(paths));
  const file = app.vault.getAbstractFileByPath(active);
  if (!(file instanceof TFile)) throw new Error('Missing fixture');
  const leaf = app.workspace.add(file);
  const plugin = new DailyNoteNavigation(app as unknown as ObsidianApp, {} as PluginManifest);
  plugin.onload();
  return { app, leaf, plugin, harness: plugin as unknown as Plugin };
}
export async function tick() { await new Promise(resolve => window.setTimeout(resolve, 10)); }
export function deferred() { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
export async function dateIs(date: string) { await vi.waitFor(() => { if (document.querySelector('.dnn-date')?.textContent !== date) throw new Error('Date not updated'); }); }
