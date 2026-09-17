// Deliberate fixture mutations, restored before the Markdown hash comparison.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, hashes, root, vault } from './native-helpers.mjs';

assert.equal(cli('vault', 'info=path'), vault);
const before = await hashes();
const result = cli('eval', `code=(${async function (application) {
  if (application.vault.getName() !== 'DNN Fixture') throw new Error('Wrong vault');
  const results = [];
  const expect = (value, message) => { if (!value) throw new Error(message); results.push(message); };
  const pause = () => new Promise(resolve => window.setTimeout(resolve, 120));
  const core = application.internalPlugins.plugins['daily-notes'];
  const oldOptions = core.instance.options;
  const scratch = 'DNN QA Temporary';
  const rootNote = '2021-02-03.md';
  if (application.vault.getAbstractFileByPath(scratch) || application.vault.getAbstractFileByPath(rootNote)) throw new Error('Fixture test paths already exist');
  const leaf = application.workspace.getMostRecentLeaf();
  const set = async (folder, format) => { core.instance.options = { ...oldOptions, folder, format }; application.workspace.trigger('layout-change'); await pause(); };
  const open = async path => { await leaf.openFile(application.vault.getAbstractFileByPath(path)); await pause(); };
  const date = () => leaf.view.containerEl.querySelector('.dnn-date');
  let other;
  try {
    await application.vault.createFolder(scratch);
    await application.vault.createFolder(scratch + '/2024');
    await application.vault.createFolder(scratch + '/2024/February');
    await application.vault.create(scratch + '/2024/February/2024-02-29.md', '# Temporary leap-day fixture');
    await application.vault.create(rootNote, '# Temporary vault-root fixture');
    await set(scratch, 'YYYY/MMMM/YYYY-MM-DD');
    await open(scratch + '/2024/February/2024-02-29.md');
    expect(date()?.textContent === '2024-02-29', 'custom folder and nested date format');
    expect([...leaf.view.containerEl.querySelectorAll('.dnn-arrow')].every(button => button.disabled), 'singleton disables both arrows');
    date().click();
    expect(document.querySelector('.dnn-calendar-footer button').disabled, 'missing today is disabled');
    expect(!application.commands.commands['daily-note-navigation:open-existing-today'].checkCallback(true), 'missing today command is unavailable');
    const file = leaf.view.file;
    await application.vault.rename(file, scratch + '/2024/February/2024-02-28.md'); await pause();
    expect(!document.querySelector('.dnn-calendar') && date()?.textContent === '2024-02-28', 'rename closes stale picker and refreshes date');
    await application.vault.rename(application.vault.getAbstractFileByPath(scratch), scratch + ' Renamed'); await pause();
    expect(!date(), 'folder rename removes stale navigation');
    await application.vault.rename(application.vault.getAbstractFileByPath(scratch + ' Renamed'), scratch); await pause();
    await set('', 'YYYY-MM-DD');
    await open(rootNote);
    expect(date()?.textContent === '2021-02-03', 'vault-root daily notes');
    await open('Journal/2026-09-16.md');
    expect(!date(), 'vault-root format does not recognize nested basenames');
    await set('Journal', 'YYYY-MM-DD');
    expect(date()?.textContent === '2026-09-16', 'settings change updates an already open note');
    const header = date().closest('.view-header');
    header.style.display = 'none';
    try { expect(!application.commands.commands['daily-note-navigation:open-date-picker'].checkCallback(true), 'hidden header makes picker command unavailable'); }
    finally { header.style.removeProperty('display'); }
    const added = await application.vault.create('Journal/2026-09-17.md', '# Temporary target'); await pause();
    try {
      date().click();
      const staleButton = document.querySelector('[data-date="2026-09-17"]');
      await application.vault.delete(added); await pause();
      staleButton.click(); await pause();
      expect(!document.querySelector('.dnn-calendar') && leaf.view.file.path === 'Journal/2026-09-16.md', 'deleted target cannot navigate through stale picker');
    } finally { if (application.vault.getAbstractFileByPath(added.path)) await application.vault.delete(added); }
    // Actual core plugin lifecycle, without persisting its enabled setting.
    await core.disable(); application.workspace.trigger('layout-change'); await pause();
    expect(!date(), 'disabling core Daily notes restores the native header');
    await core.enable(); core.instance.options = oldOptions; application.workspace.trigger('layout-change'); await pause();
    expect(date()?.textContent === '2026-09-16', 'reenabling core Daily notes restores the navigator');
    other = application.workspace.getLeaf('split');
    await other.openFile(application.vault.getAbstractFileByPath('Journal/2026-09-18.md')); await pause();
    const rectangles = [leaf, other].map(pane => {
      const container = pane.view.containerEl;
      const nav = container.querySelector('.dnn-nav').getBoundingClientRect();
      const left = container.querySelector('.view-header-left').getBoundingClientRect();
      const right = container.querySelector('.view-actions').getBoundingClientRect();
      return { width: container.getBoundingClientRect().width, fits: nav.left >= left.right && nav.right <= right.left };
    });
    expect(rectangles.every(rect => rect.fits), 'narrow panes preserve independent header controls: ' + JSON.stringify(rectangles));
    other.view.containerEl.querySelector('.dnn-date').click();
    const rect = document.querySelector('.dnn-calendar').getBoundingClientRect();
    expect(rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, 'picker stays inside viewport');
    document.querySelector('.dnn-calendar-footer button:last-child').click();
  } finally {
    other?.detach();
    if (!core.enabled) await core.enable();
    core.instance.options = oldOptions;
    application.workspace.trigger('layout-change');
    await open('Journal/2026-09-16.md');
    for (const path of [scratch, scratch + ' Renamed', rootNote]) {
      const target = application.vault.getAbstractFileByPath(path);
      if (target) await application.vault.delete(target, true);
    }
    await pause();
  }
  return JSON.stringify(results);
}})(app)`);
const results = JSON.parse(result.replace(/^=> /, ''));
assert.deepEqual(await hashes(), before);
await writeFile(join(root, 'native-scenarios-results.json'), JSON.stringify({ timestamp: new Date().toISOString(), results, fixtureRestored: true }, null, 2));
for (const result of results) console.log(`PASS ${result}`);
console.log('Fixture Markdown paths and hashes restored.');
