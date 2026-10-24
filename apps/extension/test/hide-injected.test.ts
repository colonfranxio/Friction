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
});
