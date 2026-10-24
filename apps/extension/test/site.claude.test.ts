// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { conversationIdFromPath, findComposer, isInComposer, lastAssistantText, setComposerText } from '../src/site/claude';

describe('claude site ops', () => {
  it('reads the conversation id from the URL path', () => {
    expect(conversationIdFromPath('/chat/9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4')).toBe('9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4');
    expect(conversationIdFromPath('/chat/9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4?x=1')).toBe('9b2f6c1e-3d4a-4b5c-8d6e-7f8091a2b3c4');
    expect(conversationIdFromPath('/new')).toBeNull();
    expect(conversationIdFromPath('/')).toBeNull();
  });

  it('finds the last assistant message and skips text containing a friction block', () => {
    document.body.innerHTML = `
      <div data-testid="assistant-message">first</div>
      <div data-testid="assistant-message">Quick check: what does the dependency array tell React?</div>`;
    expect(lastAssistantText(document)).toBe('Quick check: what does the dependency array tell React?');
    document.body.innerHTML = '<div data-testid="assistant-message">x ⟦friction⟧ y</div>';
    expect(lastAssistantText(document)).toBeNull();
    document.body.innerHTML = '';
    expect(lastAssistantText(document)).toBeNull();
  });

  it('rewrites a contenteditable composer (multi-line text)', async () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"><p>old</p></div>';
    const c = findComposer(document)!;
    expect(await setComposerText(document, c, 'line one\n\nline three')).toBe(true);
    expect(c.textContent).toContain('line one');
    expect(c.textContent).toContain('line three');
    expect(c.textContent).not.toContain('old');
  });

  it('knows whether an event target is inside the composer', () => {
    document.body.innerHTML = '<div class="ProseMirror" contenteditable="true"><p id="p">x</p></div><input id="i">';
    expect(isInComposer(document.getElementById('p'), document)).toBe(true);
    expect(isInComposer(document.getElementById('i'), document)).toBe(false);
  });
});
