import { Fragment } from 'react';

/** Render text safely, including unfinished code fences while a reply streams. */
export function ChatContent({ text }: { text: string }) {
  return <div className="chat-content">{text.split(/(```[\s\S]*?(?:```|$))/g).filter(Boolean).map((block, index) => {
    if (block.startsWith('```')) {
      const opening = /^```([^\n`]*)\n?/.exec(block)!;
      const language = opening[1].trim();
      const code = block.slice(opening[0].length).replace(/```$/, '').replace(/\n$/, '');
      return <figure className="code-block" key={index}><figcaption>{language || 'Code'}</figcaption><pre tabIndex={0} aria-label={`${language || 'Code'} example`}><code>{code}</code></pre></figure>;
    }
    return <Fragment key={index}>{block.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, partIndex) => part.startsWith('`') && part.endsWith('`') ? <code key={partIndex}>{part.slice(1, -1)}</code> : part.startsWith('**') && part.endsWith('**') ? <strong key={partIndex}>{part.slice(2, -2)}</strong> : part)}</p>)}</Fragment>;
  })}</div>;
}
