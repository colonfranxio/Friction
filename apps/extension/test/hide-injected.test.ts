// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { stripFrictionBlocks } from '../src/lib/hide-injected';

const BLOCK = '⟦friction⟧\nLevel: 1 (Socratic)\nInstruction: do not reveal\n⟦/friction⟧';

describe('stripFrictionBlocks', () => {
  it('removes a block inside one text node', () => {
    document.body.innerHTML = `<div data-testid="user-message"><p>How do I fix my loop?\n\n${BLOCK}</p></div>`;
    expect(stripFrictionBlocks(document.body)).toBe(1);
    expect(document.body.textContent).toBe('How do I fix my loop?');
  });

  it('removes a block split across several elements', () => {
    document.body.innerHTML = `<div><p>Question?</p><p>⟦friction⟧</p><p>Level: 1</p><p>secret ⟦/friction⟧ tail</p></div>`;
    expect(stripFrictionBlocks(document.body)).toBe(1);
    expect(document.body.textContent).toBe('Question? tail');
  });

  it('leaves an incomplete (still streaming) block alone', () => {
    document.body.innerHTML = `<p>Q ⟦friction⟧ Level: 1</p>`;
    expect(stripFrictionBlocks(document.body)).toBe(0);
    expect(document.body.textContent).toContain('⟦friction⟧');
  });

  it('never edits the composer', () => {
    document.body.innerHTML = `<div contenteditable="true"><p>Q ${BLOCK}</p></div>`;
    expect(stripFrictionBlocks(document.body)).toBe(0);
    expect(document.body.textContent).toContain('⟦friction⟧');
  });

  it('removes multiple blocks', () => {
    document.body.innerHTML = `<p>A ${BLOCK}</p><p>B ${BLOCK}</p>`;
    expect(stripFrictionBlocks(document.body)).toBe(2);
    expect(document.body.textContent).toBe('AB');
  });

  it("removes the block from ChatGPT- and Gemini-style user bubbles too (no site-specific selectors)", () => {
    document.body.innerHTML = `
      <div data-message-author-role="user"><div class="whitespace-pre-wrap">Why does my loop rerun?

${BLOCK}</div></div>
      <user-query><div class="query-text"><p class="query-text-line">Why does my loop rerun?</p><p class="query-text-line">${BLOCK}</p></div></user-query>`;
    expect(stripFrictionBlocks(document.body)).toBe(2);
    expect(document.body.textContent).not.toContain("friction");
    expect(document.body.textContent).not.toContain("Socratic");
  });

  it("never edits a Quill (Gemini) composer either", () => {
    document.body.innerHTML = `<rich-textarea><div class="ql-editor" contenteditable="true"><p>draft ${BLOCK}</p></div></rich-textarea>`;
    expect(stripFrictionBlocks(document.body)).toBe(0);
  });
});
