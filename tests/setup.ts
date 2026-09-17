import { afterEach, vi } from 'vitest';

function decorate(win: Window & typeof globalThis) {
  const proto = win.HTMLElement.prototype;
  Object.defineProperty(proto, 'win', { configurable: true, get(this: HTMLElement) { return this.ownerDocument.defaultView; } });
  Object.defineProperty(proto, 'createEl', { configurable: true, value(this: HTMLElement, tag: string, options: { cls?: string; text?: string; value?: string; attr?: Record<string, string> } = {}) {
    const el = this.ownerDocument.createElement(tag);
    if (options.cls) el.className = options.cls;
    if (options.text) el.textContent = options.text;
    if (options.value !== undefined) el.setAttribute('value', options.value);
    for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, value);
    this.appendChild(el);
    return el;
  } });
  Object.defineProperty(proto, 'createDiv', { configurable: true, value(this: HTMLElement, options: object = {}) { return this.createEl('div', options); } });
  Object.defineProperty(proto, 'empty', { configurable: true, value(this: HTMLElement) { this.replaceChildren(); } });
  Object.defineProperty(proto, 'getClientRects', { configurable: true, value() { return [{ width: 300, height: 30 }]; } });
  Object.defineProperty(win.HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(win.HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new win.Event('close')); } });
  win.requestAnimationFrame = callback => win.setTimeout(() => callback(0), 0);
  win.cancelAnimationFrame = id => win.clearTimeout(id);
}
decorate(window);
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });
export { decorate };
