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
  const doSend = () => {
    sent.push(norm(composer.textContent ?? ''));
    composer.innerHTML = '<p></p>'; // claude.ai clears the composer after sending
  };
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
  cleanup = installSendInterceptor({ doc: document, win: window, site, intercept: spy, timeoutMs, settleMs: 20, confirmMs: 80, onSent: (m) => modes.push(m) });
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

  it('while Claude is streaming (no Send button, Enter ignored): restores the original text, sends nothing', async () => {
    page.button.remove();
    // Simulate claude.ai ignoring Enter mid-stream: drop the page's own Enter handler by replacing the composer node.
    const fresh = page.composer.cloneNode(true) as HTMLElement;
    page.composer.replaceWith(fresh);
    const { modes } = install(async () => injected);
    enter(fresh);
    await vi.waitFor(() => expect(modes).toEqual(['not-sent']), { timeout: 1000 });
    expect(page.sent).toHaveLength(0);
    expect(norm(fresh.textContent ?? '')).toBe(norm(RAW));
    expect(fresh.textContent).not.toContain('⟦friction⟧');
  });

  it('a pasted friction block is stripped and the prompt still gets friction (no bypass by copy-paste)', async () => {
    page.composer.innerHTML = `<p>${RAW}\n\n⟦friction⟧\nLevel: 4 (Normal)\n⟦/friction⟧</p>`;
    const { spy, modes } = install(async () => injected);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(spy).toHaveBeenCalledWith(RAW);
    expect(page.sent[0]).toBe(norm(INJECTED));
    expect(modes).toEqual(['injected']);
  });

  it('a stray marker left after a partial erase does not skip friction', async () => {
    page.composer.innerHTML = `<p>${RAW} ⟦friction⟧</p>`;
    const { spy } = install(async () => injected);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(spy).toHaveBeenCalledWith(RAW);
    expect(page.sent[0]).toBe(norm(INJECTED));
  });

  it('passthrough sends the cleaned text, never the pasted block', async () => {
    page.composer.innerHTML = `<p>write a haiku ⟦friction⟧ Level: 4 ⟦/friction⟧</p>`;
    install(async () => ({ outcome: { passthrough: true, reason: 'no_match' }, concept_name: null }));
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm('write a haiku'));
  });

  it('falls back to Enter when there is no send button', async () => {
    page.button.remove();
    install(async () => injected);
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(INJECTED));
  });
});

describe('bypass: one prompt without friction', () => {
  let page: ReturnType<typeof fakeClaude>;
  beforeEach(() => (page = fakeClaude()));

  function installWith(extra: { skipIntercept?: (raw: string) => boolean } = {}) {
    const modes: SendMode[] = [];
    const spy = vi.fn(async () => injected);
    const ic = installSendInterceptor({ doc: document, win: window, site: realSite, intercept: spy, timeoutMs: 300, settleMs: 20, confirmMs: 80, onSent: (m) => modes.push(m), ...extra });
    cleanup = ic;
    return { ic, modes, spy };
  }

  it('sendUnmodified puts the text in the composer and sends it without calling the API', async () => {
    const { ic, spy } = installWith();
    page.composer.innerHTML = '<p></p>';
    expect(await ic.sendUnmodified(RAW)).toBe(true);
    expect(page.sent).toEqual([norm(RAW)]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('sendUnmodified reports false when the page does not send (e.g. Claude still replying)', async () => {
    const { ic } = installWith();
    page.button.disabled = true;
    page.button.replaceWith(page.button.cloneNode(true)); // drop the send handler
    page.composer.replaceWith(page.composer.cloneNode(true));
    expect(await ic.sendUnmodified(RAW)).toBe(false);
    expect(page.sent).toEqual([]);
  });

  it('skipIntercept: an armed prompt goes out unmodified once, later sends get friction again', async () => {
    let armed: string | null = RAW;
    const { modes, spy } = installWith({
      skipIntercept: (raw) => {
        if (raw !== armed) return false;
        armed = null;
        return true;
      },
    });
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(1));
    expect(page.sent[0]).toBe(norm(RAW));
    expect(spy).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0)); // let the first send finish

    page.composer.innerHTML = `<p>${RAW}</p>`;
    enter(page.composer);
    await vi.waitFor(() => expect(page.sent).toHaveLength(2));
    expect(page.sent[1]).toBe(norm(INJECTED));
    expect(modes).toEqual(['bypassed', 'injected']);
  });
});
