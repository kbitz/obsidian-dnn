// Explicit fixture-only smoke test. The production plugin never imports this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cli, hashes, root, vault } from './native-helpers.mjs';

const results = [];
function evaluate(body) {
  const code = `(async()=>{if(app.vault.getName()!=='DNN Fixture')throw new Error('Wrong vault');const result=await(async()=>{${body}})();return JSON.stringify(result??null)})()`;
  return JSON.parse(cli('eval', `code=${code}`).replace(/^=> /, ''));
}
function pause() { evaluate('await new Promise(r=>window.setTimeout(r,100));'); }
function key(key, code, number, modifiers = 0) {
  for (const type of ['keyDown', 'keyUp']) cli('dev:cdp', 'method=Input.dispatchKeyEvent', `params=${JSON.stringify({ type, key, code, windowsVirtualKeyCode: number, modifiers })}`);
}
function check(name, action) { action(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
const before = await hashes();
assert.equal(cli('vault', 'info=path'), vault);
const coreCommands = evaluate('return ["daily-notes:goto-prev","daily-notes:goto-next"].map(id=>({id,name:app.commands.commands[id].name,keys:app.hotkeyManager.getHotkeys(id)}));');
cli('open', 'path=Journal/2026-09-16.md'); pause();
check('header replacement and existing-note arrows', () => {
  assert.deepEqual(evaluate('const root=app.workspace.getMostRecentLeaf().view.containerEl; return {date:root.querySelector(".dnn-date")?.textContent,hidden:getComputedStyle(root.querySelector(".view-header-title-container > .view-header-title")).display,history:!!root.querySelector(".view-header-left"),actions:!!root.querySelector(".view-actions")}'), { date: '2026-09-16', hidden: 'none', history: true, actions: true });
  evaluate('document.querySelector(".dnn-arrow").click();'); pause();
  assert.equal(evaluate('return app.workspace.getActiveFile().path;'), 'Journal/2026-09-14.md');
  evaluate('document.querySelectorAll(".dnn-arrow")[1].click();'); pause();
  assert.equal(evaluate('return app.workspace.getActiveFile().path;'), 'Journal/2026-09-16.md');
});
check('native calendar keyboard and focus', () => {
  cli('command', 'id=daily-note-navigation:open-date-picker');
  assert.equal(evaluate('return document.activeElement.dataset.date;'), '2026-09-16');
  key('ArrowLeft', 'ArrowLeft', 37);
  assert.equal(evaluate('return document.activeElement.dataset.date;'), '2026-09-15');
  key('Enter', 'Enter', 13);
  assert.equal(evaluate('return app.workspace.getActiveFile().path;'), 'Journal/2026-09-16.md');
  assert.equal(evaluate('return document.querySelector("dialog").open;'), true);
  for (let i = 0; i < 12; i++) {
    key('Tab', 'Tab', 9);
    assert.equal(evaluate('return !!document.activeElement.closest(".dnn-calendar");'), true);
  }
  key('Escape', 'Escape', 27);
  assert.equal(evaluate('return document.activeElement.className;'), 'dnn-date');
  assert.equal(evaluate('return !!document.querySelector(".dnn-calendar");'), false);
});
check('native outside-click dismissal and history', () => {
  cli('command', 'id=daily-note-navigation:open-date-picker');
  const point = evaluate('const r=document.querySelector(".dnn-calendar").getBoundingClientRect();return {x:r.left+2,y:r.bottom+12};');
  for (const type of ['mousePressed', 'mouseReleased']) cli('dev:cdp', 'method=Input.dispatchMouseEvent', `params=${JSON.stringify({ type, ...point, button: 'left', clickCount: 1 })}`);
  assert.equal(evaluate('return !!document.querySelector(".dnn-calendar");'), false);
  evaluate('document.querySelector(".dnn-arrow").click();'); pause();
  cli('command', 'id=app:go-back'); pause();
  assert.equal(evaluate('return app.workspace.getActiveFile().path;'), 'Journal/2026-09-16.md');
});
check('direct year selection retrieves an old note', () => {
  cli('command', 'id=daily-note-navigation:open-date-picker');
  evaluate('const y=document.querySelector(".dnn-year");y.value="2020";y.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));const m=document.querySelector(".dnn-month-controls select");m.value="1";m.dispatchEvent(new Event("change"));document.querySelector("[data-date=\\"2020-02-29\\"]").click();');
  pause();
  assert.equal(evaluate('return app.workspace.getActiveFile().path;'), 'Journal/2020-02-29.md');
  assert.equal(evaluate('return document.activeElement.className;'), 'dnn-date');
});
check('ordinary notes restore the native breadcrumb', () => {
  cli('open', 'path=Ordinary.md'); pause();
  assert.equal(evaluate('return !!document.querySelector(".dnn-nav");'), false);
  cli('open', 'path=Journal/2026-09-16.md'); pause();
});
check('user-configured command shortcut', () => {
  const prior = evaluate('return app.hotkeyManager.getHotkeys("daily-note-navigation:open-date-picker");');
  try {
    evaluate('app.hotkeyManager.setHotkeys("daily-note-navigation:open-date-picker",[{modifiers:["Mod","Shift"],key:"Y"}]);');
    key('Y', 'KeyY', 89, 12);
    assert.equal(evaluate('return !!document.querySelector(".dnn-calendar")?.open;'), true);
    key('Escape', 'Escape', 27);
  } finally {
    evaluate(prior ? `app.hotkeyManager.setHotkeys("daily-note-navigation:open-date-picker",${JSON.stringify(prior)});` : 'app.hotkeyManager.removeHotkeys("daily-note-navigation:open-date-picker");');
  }
});
check('reading mode', () => {
  evaluate('await app.workspace.getMostRecentLeaf().view.setState({file:"Journal/2026-09-16.md",mode:"preview"},{});'); pause();
  cli('command', 'id=daily-note-navigation:open-date-picker');
  assert.equal(evaluate('return !!document.querySelector(".dnn-calendar")?.open;'), true);
  key('Escape', 'Escape', 27);
  evaluate('await app.workspace.getMostRecentLeaf().view.setState({file:"Journal/2026-09-16.md",mode:"source"},{});'); pause();
});
check('repeated disable/enable restores native nodes and avoids duplicates', () => {
  for (let i = 0; i < 3; i++) {
    cli('plugin:disable', 'id=daily-note-navigation');
    assert.equal(evaluate('return !!document.querySelector(".dnn-mounted");'), false);
    cli('plugin:enable', 'id=daily-note-navigation'); pause();
    assert.equal(evaluate('return document.querySelectorAll(".dnn-nav").length;'), 1);
  }
});
check('multiple panes and pinned originating pane', () => {
  evaluate('window.__dnnOrigin=app.workspace.getMostRecentLeaf();window.__dnnOther=app.workspace.getLeaf("split");await window.__dnnOther.openFile(app.vault.getAbstractFileByPath("Journal/2026-09-18.md"));window.__dnnOrigin.setPinned(true);'); pause();
  evaluate('window.__dnnOrigin.view.containerEl.querySelector(".dnn-arrow").click();'); pause();
  assert.deepEqual(evaluate('return [window.__dnnOrigin.view.file.path,window.__dnnOther.view.file.path,window.__dnnOrigin.getViewState().pinned];'), ['Journal/2026-09-14.md', 'Journal/2026-09-18.md', true]);
  evaluate('window.__dnnOrigin.setPinned(false);window.__dnnOther.detach();delete window.__dnnOther;delete window.__dnnOrigin;'); pause();
});
check('pop-out owns its picker and cleans it up', () => {
  evaluate('window.__dnnPop=app.workspace.getLeaf("window");await window.__dnnPop.openFile(app.vault.getAbstractFileByPath("Journal/2026-09-16.md"));'); pause();
  evaluate('window.__dnnPop.view.containerEl.querySelector(".dnn-date").click();');
  assert.deepEqual(evaluate('const d=window.__dnnPop.view.containerEl.ownerDocument;return {different:d!==document,open:!!d.querySelector(".dnn-calendar")?.open,date:d.activeElement.dataset.date};'), { different: true, open: true, date: '2026-09-16' });
  evaluate('const remote=require("@electron/remote");window.__dnnPopWindow=remote.BrowserWindow.getAllWindows().find(w=>w.id!==remote.getCurrentWindow().id&&w.getTitle().includes("DNN Fixture"));window.__dnnPopWindow.focus();window.__dnnPopWindow.webContents.sendInputEvent({type:"keyDown",keyCode:"Tab"});window.__dnnPopWindow.webContents.sendInputEvent({type:"keyUp",keyCode:"Tab"});'); pause();
  assert.equal(evaluate('return !!window.__dnnPop.view.containerEl.ownerDocument.activeElement.closest(".dnn-calendar");'), true);
  evaluate('window.__dnnPopWindow.webContents.sendInputEvent({type:"keyDown",keyCode:"Escape"});window.__dnnPopWindow.webContents.sendInputEvent({type:"keyUp",keyCode:"Escape"});'); pause();
  assert.deepEqual(evaluate('const d=window.__dnnPop.view.containerEl.ownerDocument;return {closed:!d.querySelector(".dnn-calendar"),focus:d.activeElement.className};'), { closed: true, focus: 'dnn-date' });
  evaluate('window.__dnnPop.detach();delete window.__dnnPop;delete window.__dnnPopWindow;'); pause();
});
cli('open', 'path=Journal/2026-09-16.md'); pause();
check('both configurable shortcuts in source, reading, and pop-out views', () => {
  const ids = ['daily-note-navigation:open-date-picker', 'daily-note-navigation:open-existing-today'];
  const prior = ids.map(id => evaluate(`return app.hotkeyManager.getHotkeys(${JSON.stringify(id)});`));
  const today = evaluate('const t=new Date();return [String(t.getFullYear()).padStart(4,"0"),String(t.getMonth()+1).padStart(2,"0"),String(t.getDate()).padStart(2,"0")].join("-");');
  assert.equal(evaluate(`return !!app.vault.getAbstractFileByPath("Journal/${today}.md");`), true, 'This fixture must include today to exercise its existing-only shortcut');
  try {
    ids.forEach((id, i) => evaluate(`app.hotkeyManager.setHotkeys(${JSON.stringify(id)},[{modifiers:["Mod","Shift"],key:"${i ? 'U' : 'Y'}"}]);`));
    for (const mode of ['source', 'preview', 'pop-out']) {
      if (mode === 'pop-out') evaluate('window.__dnnShortcutLeaf=app.workspace.getLeaf("window");app.workspace.setActiveLeaf(window.__dnnShortcutLeaf,{focus:true});');
      else evaluate('window.__dnnShortcutLeaf=app.workspace.getMostRecentLeaf();');
      evaluate(`await window.__dnnShortcutLeaf.openFile(app.vault.getAbstractFileByPath("Journal/2026-09-14.md"));await window.__dnnShortcutLeaf.view.setState({file:"Journal/2026-09-14.md",mode:"${mode === 'preview' ? 'preview' : 'source'}"},{});`); pause();
      const keyboard = value => {
        if (mode !== 'pop-out') { key(value, `Key${value}`, value.charCodeAt(0), 12); return; }
        evaluate(`const remote=require("@electron/remote");const w=remote.BrowserWindow.getAllWindows().find(w=>w.id!==remote.getCurrentWindow().id&&w.getTitle().includes("DNN Fixture"));w.focus();for(const type of ["keyDown","keyUp"])w.webContents.sendInputEvent({type,keyCode:"${value}",modifiers:["meta","shift"]});`); pause();
      };
      keyboard('Y');
      assert.equal(evaluate('return !!window.__dnnShortcutLeaf.view.containerEl.ownerDocument.querySelector(".dnn-calendar")?.open;'), true, `${mode} picker shortcut`);
      evaluate('window.__dnnShortcutLeaf.view.containerEl.ownerDocument.querySelector(".dnn-calendar-footer button:last-child").click();');
      keyboard('U'); pause();
      assert.equal(evaluate('return window.__dnnShortcutLeaf.view.file.path;'), `Journal/${today}.md`, `${mode} Today shortcut`);
      if (mode === 'pop-out') evaluate('window.__dnnShortcutLeaf.detach();');
    }
  } finally {
    ids.forEach((id, i) => evaluate(prior[i] ? `app.hotkeyManager.setHotkeys(${JSON.stringify(id)},${JSON.stringify(prior[i])});` : `app.hotkeyManager.removeHotkeys(${JSON.stringify(id)});`));
    evaluate('delete window.__dnnShortcutLeaf;');
  }
});
assert.deepEqual(await hashes(), before);
assert.deepEqual(evaluate('return ["daily-notes:goto-prev","daily-notes:goto-next"].map(id=>({id,name:app.commands.commands[id].name,keys:app.hotkeyManager.getHotkeys(id)}));'), coreCommands);
results.push({ name: 'all fixture Markdown paths and hashes unchanged', passed: true });
await mkdir(root, { recursive: true });
await writeFile(join(root, 'native-smoke-results.json'), JSON.stringify({ timestamp: new Date().toISOString(), version: cli('version'), results }, null, 2));
console.log(`${results.length} native checks passed; fixture notes unchanged.`);
