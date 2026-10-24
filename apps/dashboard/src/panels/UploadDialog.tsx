import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X } from 'lucide-react';
import { api } from '../lib/api';

function pdfBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that PDF. Please try again.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}
export function UploadDialog({ close, complete }: { close: () => void; complete: (treeId: string) => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  const choose = (next?: File) => {
    if (!next) return;
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF or paste your syllabus below.'); return; }
    if (next.size > 20 * 1024 * 1024) { setError('Please choose a PDF smaller than 20 MB.'); return; }
    setFile(next); setError('');
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const result = await api.parseTree(file ? { kind: 'pdf', base64: await pdfBase64(file), filename: file.name } : { kind: 'text', text: text.trim() });
      complete(result.tree_id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this syllabus.'); setBusy(false); }
  };
  return createPortal(<dialog ref={dialog} className="upload-dialog" aria-labelledby="upload-title" onCancel={(e) => { if (busy) e.preventDefault(); else close(); }}>
    <div className="dialog-heading"><div><span className="eyebrow">FROM SYLLABUS TO POSSIBILITIES</span><h2 id="upload-title">Generate a skill tree</h2></div><button aria-label="Close upload" disabled={busy} onClick={close} className="icon-button"><X size={20} /></button></div>
    {busy ? <div className="parsing-state" role="status"><div className="ghost-pillars">{[0, 1, 2].map((pillar) => <div key={pillar}>{[0, 1, 2].map((node) => <i key={node} style={{ animationDelay: `${(pillar * 3 + node) * .2}s` }} />)}</div>)}</div><h3>Connecting the dots…</h3><p>Reading syllabus… finding concepts… linking prerequisites…</p><small>This can take up to a minute. Good connections take a little thought.</small></div> : <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="drop-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}><Upload size={27} /><strong>{file?.name ?? 'Drop a syllabus PDF here'}</strong><span>or click to choose · up to 20 MB</span><input aria-label="Syllabus PDF" type="file" accept="application/pdf,.pdf" onChange={(e) => choose(e.target.files?.[0])} /></label>
      {file && <button type="button" className="text-button" onClick={() => setFile(undefined)}>Remove PDF and use text</button>}
      <label className="text-syllabus">Or paste your syllabus<textarea aria-label="Syllabus text" disabled={!!file} rows={6} placeholder="Course goals, concepts, and what students should be able to do…" value={text} onChange={(e) => setText(e.target.value)} /></label>
      {error && <p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" onClick={close}>Cancel</button><button className="primary-button" disabled={!file && !text.trim()}>Generate tree</button></div>
    </form>}
  </dialog>, document.body);
}
