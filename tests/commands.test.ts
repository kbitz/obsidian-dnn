import { describe, expect, it, vi } from 'vitest';
import { deferred, fixture, tick } from './helpers';
import { notices, TFile } from './obsidian';

describe('native command integration', () => {
  it('registers only the two missing commands with no default bindings', () => {
    const { plugin, harness } = fixture();
    expect(harness.commands.map(command => command.id)).toEqual(['open-date-picker', 'open-existing-today']);
    expect(harness.commands.every(command => command.hotkeys === undefined)).toBe(true);
    plugin.unload(); expect(harness.commands).toHaveLength(0);
  });
  it('checks availability without opening or changing focus; executes the picker once', () => {
    const { plugin, harness, leaf } = fixture();
    const command = harness.commands[0]!;
    const initial = document.activeElement;
    expect(command.checkCallback(true)).toBe(true);
    expect(document.activeElement).toBe(initial);
    expect(document.querySelector('dialog')).toBeNull();
    expect(leaf.openFile).not.toHaveBeenCalled();
    command.checkCallback(false); command.checkCallback(false);
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    plugin.unload(); expect(document.querySelector('dialog')).toBeNull();
  });
  it('does not offer actions for ordinary or hidden-header notes', async () => {
    const { plugin, harness, leaf } = fixture();
    const button = document.querySelector<HTMLButtonElement>('.dnn-date')!;
    vi.spyOn(button, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);
    expect(harness.commands[0]?.checkCallback(true)).toBe(false);
    await leaf.openFile(new TFile('Ordinary.md')); await tick();
    expect(harness.commands.every(command => command.checkCallback(true) === false)).toBe(true);
    plugin.unload();
  });
  it('revalidates settings at execution and never opens a stale target', () => {
    const { plugin, harness, app, leaf } = fixture();
    expect(harness.commands[0]?.checkCallback(true)).toBe(true);
    app.internalPlugins.plugins['daily-notes'].enabled = false;
    harness.commands[0]?.checkCallback(false);
    expect(document.querySelector('dialog')).toBeNull();
    expect(leaf.openFile).not.toHaveBeenCalled();
    plugin.unload();
  });
  it('opens only an existing Today and blocks deletion between check and execution', async () => {
    vi.setSystemTime(new Date('2026-09-18T12:00:00'));
    const { plugin, harness, app, leaf } = fixture();
    const today = harness.commands[1]!;
    expect(today.checkCallback(true)).toBe(true);
    app.vault.remove('Journal/2026-09-18.md');
    today.checkCallback(false); await tick();
    expect(leaf.openFile).not.toHaveBeenCalled();
    expect(today.checkCallback(true)).toBe(false);
    expect(notices.at(-1)).toContain('no longer available');
    plugin.unload();
  });
  it('hides palette commands while navigation is pending', async () => {
    const { plugin, harness, leaf } = fixture();
    const open = deferred();
    leaf.openFile.mockImplementationOnce(() => open.promise);
    document.querySelector<HTMLButtonElement>('[aria-label="Open next daily note"]')!.click();
    expect(harness.commands.every(command => command.checkCallback(true) === false)).toBe(true);
    open.resolve();
    await tick();
    plugin.unload();
  });
  it('opens an existing Today in the active pane', async () => {
    vi.setSystemTime(new Date('2026-09-18T12:00:00'));
    const { plugin, harness, leaf } = fixture();
    harness.commands[1]!.checkCallback(false); await tick();
    expect(leaf.openFile.mock.calls[0]?.[0].path).toBe('Journal/2026-09-18.md');
    expect(document.querySelector('.dnn-date')?.textContent).toBe('2026-09-18');
    plugin.unload();
  });
});
