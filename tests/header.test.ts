import { afterEach, describe, expect, it, vi } from 'vitest';
import moment from 'moment';
import type { App as ObsidianApp } from 'obsidian';
import { mountHeader } from '../src/header';
import { readDailySettings } from '../src/main';
import { MarkdownView, notices, TFile, TFolder } from './obsidian';
import { dateIs, deferred, fixture, tick } from './helpers';

afterEach(() => { notices.length = 0; });
describe('header ownership', () => {
  it('preserves native nodes and restores them on disposal', () => {
    const view = new MarkdownView(new TFile('Journal/2026-09-16.md'));
    const title = view.containerEl.querySelector('.view-header-title');
    const changed = vi.fn();
    const binding = mountHeader(view.containerEl, { date: '2026-09-16', pending: false }, { previous: vi.fn(), next: vi.fn(), picker: vi.fn() }, changed)!;
    expect(binding.dateButton.textContent).toBe('2026-09-16');
    expect(view.containerEl.querySelector('.view-header-title')).toBe(title);
    expect(view.containerEl.querySelector('.view-header-left')?.textContent).toBe('History');
    expect(view.containerEl.querySelector('.view-actions')?.textContent).toBe('Actions');
    expect(view.containerEl.querySelector('.dnn-mounted')).not.toBeNull();
    binding.dispose(); binding.dispose();
    expect(view.containerEl.querySelector('.dnn-nav')).toBeNull();
    expect(view.containerEl.querySelector('.dnn-mounted')).toBeNull();
    expect(view.containerEl.querySelector('.view-header-title')).toBe(title);
  });
  it('fails closed when markup is missing', () => {
    const container = document.body.createDiv();
    expect(mountHeader(container, { date: '2026-09-16', pending: false }, { previous: vi.fn(), next: vi.fn(), picker: vi.fn() }, vi.fn())).toBeNull();
    expect(container.childElementCount).toBe(0);
  });
  it('removes its marker when title structure is lost', async () => {
    const view = new MarkdownView(new TFile('x'));
    const changed = vi.fn();
    const binding = mountHeader(view.containerEl, { date: '2026-09-16', pending: false }, { previous: vi.fn(), next: vi.fn(), picker: vi.fn() }, changed)!;
    view.containerEl.querySelector('.view-header-title')?.remove();
    await tick();
    expect(binding.valid()).toBe(false);
    expect(view.containerEl.querySelector('.dnn-mounted')).toBeNull();
    expect(changed).toHaveBeenCalled();
    binding.dispose();
  });
});

describe('settings and controller', () => {
  it('uses documented defaults when core options are absent', () => {
    const app = { internalPlugins: { plugins: { 'daily-notes': { enabled: true, instance: {} } } } };
    expect(readDailySettings(app as unknown as ObsidianApp, moment)).toEqual({ folder: '', format: 'YYYY-MM-DD', locale: 'en' });
  });
  it.each([{}, { internalPlugins: {} }, { internalPlugins: { plugins: { 'daily-notes': { enabled: true } } } }, { internalPlugins: { plugins: { 'daily-notes': { enabled: true, instance: { options: { folder: 4 } } } } } }])('rejects an unavailable settings shape without guessing', app => {
    expect(() => readDailySettings(app as unknown as ObsidianApp, moment)).toThrow();
  });
  it('reads configured folder and defaults while rejecting invalid internal state', () => {
    const { app, plugin } = fixture();
    expect(readDailySettings(app as unknown as ObsidianApp, moment).folder).toBe('Journal');
    app.internalPlugins.plugins['daily-notes'].enabled = false;
    expect(() => readDailySettings(app as unknown as ObsidianApp, moment)).toThrow('Enable');
    plugin.unload();
  });
  it('navigates across gaps in the clicked pinned pane and preserves the other pane', async () => {
    const { app, leaf, plugin } = fixture();
    leaf.pinned = true;
    const other = app.workspace.add(new TFile('Journal/2026-09-14.md'));
    app.workspace.trigger('layout-change'); await tick();
    leaf.view.containerEl.querySelector<HTMLButtonElement>('[aria-label="Open previous daily note"]')!.click();
    await dateIs('2026-09-14');
    expect(leaf.openFile).toHaveBeenCalledTimes(1);
    expect(other.openFile).not.toHaveBeenCalled();
    expect(leaf.pinned).toBe(true);
    plugin.unload();
  });
  it('restores ordinary notes and mounts once after repeated reconciliation', async () => {
    const { app, leaf, plugin } = fixture();
    for (let i = 0; i < 25; i++) app.workspace.trigger('layout-change');
    await tick(); expect(document.querySelectorAll('.dnn-nav')).toHaveLength(1);
    await leaf.openFile(new TFile('Ordinary.md')); await tick();
    expect(document.querySelector('.dnn-mounted')).toBeNull();
    await leaf.openFile(new TFile('Journal/2026-09-16.md')); await tick();
    expect(document.querySelectorAll('.dnn-nav')).toHaveLength(1);
    plugin.unload();
    app.workspace.trigger('layout-change'); await tick();
    expect(document.querySelector('.dnn-nav')).toBeNull();
  });
  it('recomputes the neighbor from a dirty index at click time', async () => {
    const { app, leaf, plugin } = fixture();
    app.vault.add('Journal/2026-09-15.md');
    document.querySelector<HTMLButtonElement>('[aria-label="Open previous daily note"]')!.click();
    await dateIs('2026-09-15');
    expect(leaf.openFile.mock.calls[0]?.[0].path).toBe('Journal/2026-09-15.md');
    plugin.unload();
  });
  it('keeps navigation blocked after a header remount during an in-flight open', async () => {
    const { leaf, plugin, harness } = fixture();
    const open = deferred();
    leaf.openFile.mockImplementationOnce(() => open.promise);
    document.querySelector<HTMLButtonElement>('[aria-label="Open previous daily note"]')!.click();
    const title = leaf.view.containerEl.querySelector<HTMLElement>('.view-header-title-container')!;
    const replacement = document.createElement('div'); replacement.className = 'view-header-title-container';
    replacement.createDiv({ cls: 'view-header-title', text: 'Updated by Obsidian' });
    title.replaceWith(replacement);
    await tick();
    expect(replacement.querySelector<HTMLButtonElement>('.dnn-date')?.disabled).toBe(true);
    expect(harness.commands.every(command => command.checkCallback(true) === false)).toBe(true);
    replacement.querySelector<HTMLButtonElement>('[aria-label="Open next daily note"]')!.click();
    expect(leaf.openFile).toHaveBeenCalledTimes(1);
    open.resolve(); await tick();
    plugin.unload();
  });
  it('remounts once after Obsidian replaces the header title container', async () => {
    const { leaf, plugin } = fixture();
    const title = leaf.view.containerEl.querySelector<HTMLElement>('.view-header-title-container')!;
    const replacement = document.createElement('div'); replacement.className = 'view-header-title-container';
    replacement.createDiv({ cls: 'view-header-title', text: 'Updated by Obsidian' });
    title.replaceWith(replacement);
    await tick();
    expect(replacement.querySelectorAll('.dnn-nav')).toHaveLength(1);
    expect(title.classList.contains('dnn-mounted')).toBe(false);
    plugin.unload();
  });
  it('does not recreate a detached pane after an in-flight open completes', async () => {
    const { app, leaf, plugin } = fixture();
    const opening = deferred(); leaf.openFile.mockImplementationOnce(() => opening.promise);
    document.querySelector<HTMLButtonElement>('.dnn-arrow')!.click();
    app.workspace.leaves = []; leaf.view.containerEl.remove(); app.workspace.trigger('layout-change');
    opening.resolve(); await tick();
    expect(document.querySelector('.dnn-nav')).toBeNull();
    expect(leaf.view.containerEl.querySelector('.dnn-nav')).toBeNull();
    plugin.unload();
  });
  it('restores a background window even when its animation frames are suspended', async () => {
    const { leaf, plugin } = fixture();
    const frames = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(999);
    try {
      await leaf.openFile(new TFile('Ordinary.md'));
      await vi.waitFor(() => expect(document.querySelector('.dnn-nav')).toBeNull());
      expect(frames).toHaveBeenCalledTimes(1);
    } finally { plugin.unload(); frames.mockRestore(); }
  });
  it('does not navigate after the settings change', () => {
    const { app, leaf, plugin } = fixture();
    app.internalPlugins.plugins['daily-notes'].instance.options.folder = 'Missing';
    document.querySelector<HTMLButtonElement>('[aria-label="Open previous daily note"]')!.click();
    expect(leaf.openFile).not.toHaveBeenCalled();
    expect(document.querySelector('.dnn-nav')).toBeNull();
    expect(notices.at(-1)).toContain('folder');
    plugin.unload();
  });
  it('does not treat a no-op open as navigation success', async () => {
    const { leaf, plugin } = fixture();
    leaf.openFile.mockImplementationOnce(async () => {});
    document.querySelector<HTMLButtonElement>('.dnn-date')!.click();
    document.querySelector<HTMLButtonElement>('[data-date="2026-09-14"]')!.click();
    await tick();
    expect(document.querySelector('dialog')?.open).toBe(true);
    expect(document.querySelector('.dnn-date')?.textContent).toBe('2026-09-16');
    plugin.unload();
  });
  it('blocks overlapping navigation and recovers from rejection', async () => {
    const { leaf, plugin } = fixture();
    const open = deferred(); leaf.openFile.mockImplementationOnce(() => open.promise);
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Open next daily note"]')!;
    next.click(); next.click();
    expect(leaf.openFile).toHaveBeenCalledTimes(1);
    expect(next.disabled).toBe(true);
    open.reject(new Error('failure')); await tick();
    expect(next.disabled).toBe(false);
    expect(notices.at(-1)).toContain('Could not open');
    plugin.unload();
  });
  it('skips a deleted neighbor and does no work after unload', async () => {
    const { app, leaf, plugin } = fixture();
    app.vault.remove('Journal/2026-09-14.md');
    document.querySelector<HTMLButtonElement>('[aria-label="Open previous daily note"]')!.click();
    await dateIs('2024-02-29');
    expect(leaf.openFile.mock.calls[0]?.[0].path).toBe('Journal/2024-02-29.md');
    app.vault.add('Journal/2026-09-15.md'); plugin.unload(); await tick();
    expect(document.querySelector('.dnn-nav')).toBeNull();
  });
  it('defers unopened views and disables both arrows for a singleton', async () => {
    const { app, leaf, plugin } = fixture(['Journal/2026-09-16.md']);
    expect([...document.querySelectorAll<HTMLButtonElement>('.dnn-arrow')].every(button => button.disabled)).toBe(true);
    const other = app.workspace.add(new TFile('Journal/2026-09-16.md')); other.isDeferred = true;
    app.workspace.trigger('layout-change'); await tick();
    expect(other.view.containerEl.querySelector('.dnn-nav')).toBeNull();
    expect(leaf.view.containerEl.querySelector('.dnn-nav')).not.toBeNull();
    plugin.unload();
  });
  it('coalesces file-event bursts and never rebuilds on content edits', async () => {
    const { app, plugin } = fixture();
    const folder = app.vault.getAbstractFileByPath('Journal');
    if (!(folder instanceof TFolder)) throw new Error('Missing fixture folder');
    const children = folder.children;
    const read = vi.fn(() => children);
    Object.defineProperty(folder, 'children', { get: read, configurable: true });
    for (let i = 0; i < 50; i++) app.vault.trigger('rename');
    await tick();
    expect(read).toHaveBeenCalledTimes(1);
    app.vault.trigger('modify'); app.workspace.trigger('layout-change'); await tick();
    expect(read).toHaveBeenCalledTimes(1);
    plugin.unload();
  });
  it('cancels an old binding after the originating pane switches files', async () => {
    const { leaf, plugin } = fixture();
    const old = document.querySelector<HTMLButtonElement>('.dnn-arrow')!;
    leaf.view.file = new TFile('Ordinary.md'); old.click();
    expect(leaf.openFile).not.toHaveBeenCalled();
    plugin.unload(); await tick();
  });
  it('restores headers and deduplicates notices when the dependency is disabled', async () => {
    const { app, plugin } = fixture();
    app.internalPlugins.plugins['daily-notes'].enabled = false;
    for (let i = 0; i < 3; i++) { app.workspace.trigger('layout-change'); await tick(); }
    expect(document.querySelector('.dnn-nav')).toBeNull();
    expect(notices.filter(value => value.includes('Enable'))).toHaveLength(1);
    app.internalPlugins.plugins['daily-notes'].enabled = true;
    app.workspace.trigger('layout-change'); await tick();
    expect(document.querySelector('.dnn-date')?.textContent).toBe('2026-09-16');
    plugin.unload();
  });
});
