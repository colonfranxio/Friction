// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InterceptRuntimeResult } from '../src/background-types';
import { installSendInterceptor, type SendMode, type SiteOps } from '../src/lib/send-interceptor';
import * as realSite from '../src/site/claude';

const RAW = 'How do I stop my useEffect from running in an infinite loop?';
const INJECTED = `${RAW}\n\n⟦friction⟧\nLevel: 1 (Socratic)\nInstruction: ask the student to explain\n⟦/friction⟧`;
// Paragraph breaks become whitespace differences depending on how the DOM is read; compare without whitespace.
const norm = (s: string) => s.replace(/\s+/g, '');

const injected: InterceptRuntimeResult = {
  outcome: {
    passthrough: false,
    response: { intercept_id: 'ic', node_id: 'n', level: 1, injected_prompt: INJECTED, quiz_attached: true, graded: null },
  },
  concept_name: 'React useEffect',
};

/** A tiny fake claude.ai: composer + send button; Enter in the composer also sends (like ProseMirror's keymap). */
function fakeClaude() {
  document.body.innerHTML = `
    <fieldset>
      <div class="ProseMirror" contenteditable="true"><p>${RAW}</p></div>
      <button aria-label="Send message">Send</button>
    </fieldset>`;
  const composer = document.querySelector<HTMLElement>('.ProseMirror')!;
  const button = document.querySelector<HTMLButtonElement>('button')!;
  const sent: string[] = [];
  const doSend = () => sent.push(norm(composer.textContent ?? ''));
  button.addEventListener('click', doSend);
  composer.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) doSend();
  });
  return { composer, button, sent };
}

let cleanup: () => void = () => {};
afterEach(() => cleanup());

function install(intercept: (raw: string) => Promise<InterceptRuntimeResult>, site: SiteOps = realSite, timeoutMs = 300) {
  const modes: SendMode[] = [];
  const spy = vi.fn(intercept);
  cleanup = installSendInterceptor({ doc: document, win: window, site, intercept: spy, timeoutMs, settleMs: 1, onSent: (m) => modes.push(m) });
  return { modes, spy };
}

const enter = (el: Element, shift = false) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: shift, bubbles: true, cancelable: true }));

describe('send interceptor', () => {
  let page: ReturnType<typeof fakeClaude>;
  beforeEach(() => (page = fakeClaude()));

  it('Enter: injects the friction block and sends exactly once', async () => {
    const { modes, spy } = install(async () => injected);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(spy).toHaveBeenCalledWith(RAW);
    expect(page.sent[0]).toBe(norm(INJECTED));
    expect(modes).toEqual(['injected']);
  });

  it('click on Send: same behavior', async () => {
    install(async () => injected);
    page.button.click();
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(INJECTED));
  });

  it('passthrough: sends the original text unchanged', async () => {
    const { modes } = install(async () => ({ outcome: { passthrough: true, reason: 'no_match' }, concept_name: null }));
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(RAW));
    expect(modes).toEqual(['passthrough']);
  });

  it('fails open when the intercept call throws', async () => {
    const { modes } = install(async () => {
      throw new Error('extension context invalidated');
    });
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(RAW));
    expect(modes).toEqual(['failed-open']);
  });

  it('fails open when the intercept call hangs past the timeout', async () => {
    const { modes } = install(() => new Promise(() => {}), realSite, 50);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1), { timeout: 1000 });
    expect(page.sent[0]).toBe(norm(RAW));
    expect(modes).toEqual(['failed-open']);
  });

  it('fails open (restoring the original text) when the composer cannot be rewritten', async () => {
    const calls: string[] = [];
    const site: SiteOps = {
      ...realSite,
      setComposerText: async (doc, el, text) => {
        calls.push(text);
        if (text === RAW) return realSite.setComposerText(doc, el, text);
        return false;
      },
    };
    const { modes } = install(async () => injected, site);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(RAW));
    expect(calls).toEqual([INJECTED, RAW]);
    expect(modes).toEqual(['failed-open']);
  });

  it('ignores Shift+Enter (new line) and lets the page handle it', async () => {
    const { spy } = install(async () => injected);
    const ev = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
    page.composer.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores Enter outside the composer', async () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="search">');
    const { spy } = install(async () => injected);
    enter(document.getElementById('search')!);
    expect(spy).not.toHaveBeenCalled();
  });

  it('swallows repeated Enters while a send is in flight (no double send)', async () => {
    let release!: (r: InterceptRuntimeResult) => void;
    const { spy } = install(() => new Promise((r) => (release = r)));
    enter(page.composer);
    enter(page.composer);
    page.button.click();
    release(injected);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(page.sent).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('empty composer: does not call the API', async () => {
    page.composer.innerHTML = '<p></p>';
    const { spy } = install(async () => injected);
    enter(page.composer);
    await new Promise((r) => setTimeout(r, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to Enter when there is no send button', async () => {
    page.button.remove();
    install(async () => injected);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(INJECTED));
  });
});
