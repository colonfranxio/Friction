import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, MessageCircle, Plus, RotateCcw } from 'lucide-react';
import { ApiError, CHAT_HEADERS, SEED_IDS, type BloomLevel, type ChatMessage } from '@friction/shared';
import { api } from '../lib/api';
import { useTreeData } from '../lib/useTreeData';
import { useStudentData } from '../lib/useStudentData';
import { levelLabel } from '../lib/format';
import { TopBar } from '../panels/TopBar';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';

type Bubble = ChatMessage & { id: string; concept?: string; nodeId?: string; level?: BloomLevel; complete?: boolean };
export function SandboxPage() {
  const [studentId, setStudentId] = useState<string>(SEED_IDS.demoStudent);
  const profile = useStudentData(studentId);
  const student = profile.student;
  const [conversation, setConversation] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedTurn, setSelectedTurn] = useState<string>();
  const [bypassBusy, setBypassBusy] = useState(false);
  const [bypassMessage, setBypassMessage] = useState('');
  const [demo, setDemo] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const data = useTreeData(student?.tree_id ?? undefined);
  useEffect(() => { if (data.live || data.treeRevision) void profile.refresh(); }, [data.live, data.treeRevision, profile.refresh]);
  const currentStudent = data.students.find((s) => s.user.id === studentId);
  const quota = currentStudent?.user.bypass_quota ?? student?.user.bypass_quota ?? 0;
  useEffect(() => { let current = true; api.health().then((health) => { if (current) setDemo(health.mode.demo); }).catch(() => {}); return () => { current = false; }; }, []);
  useEffect(() => () => { request.current?.abort(); }, [studentId]);
  const lastTree = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (student && lastTree.current !== student.tree_id) {
      if (lastTree.current !== undefined) newChat();
      lastTree.current = student.tree_id;
    }
  }, [student?.tree_id]);
  useEffect(() => { scroll.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages]);
  const newChat = () => {
    request.current?.abort(); request.current = undefined;
    setBusy(false); setMessages([]); setConversation(crypto.randomUUID()); setSelectedTurn(undefined); setError(''); setBypassMessage('');
  };
  const send = async () => {
    if (!text.trim() || busy || resetBusy || bypassBusy || !student?.tree_id) return;
    const controller = new AbortController(); request.current = controller;
    const raw = text.trim(); const id = crypto.randomUUID();
    const history: ChatMessage[] = [...messages.filter((m) => m.role === 'user' || m.complete).map(({ role, content }) => ({ role, content })), { role: 'user', content: raw }];
    setMessages((all) => [...all, { id: crypto.randomUUID(), role: 'user', content: raw }]);
    setText(''); setBusy(true); setError('');
    try {
      const response = await api.chat({ student_id: studentId, conversation_id: conversation, messages: history }, controller.signal);
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.error?.message ?? `Chat is unavailable (${response.status}). Please try again.`);
      }
      if (!response.body) throw new Error('The reply stream was empty. Please try again.');
      const headerLevel = Number(response.headers.get(CHAT_HEADERS.level));
      const level = headerLevel >= 1 && headerLevel <= 4 ? headerLevel as BloomLevel : undefined;
      const nodeId = response.headers.get(CHAT_HEADERS.nodeId);
      const concept = data.bundle?.nodes.find((n) => n.id === nodeId)?.concept_name;
      if (controller.signal.aborted) return;
      setMessages((all) => [...all, { id, role: 'assistant', content: '', concept, nodeId: nodeId || undefined, level }]); setSelectedTurn(id);
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
          if (controller.signal.aborted) break;
          setMessages((all) => all.map((m) => m.id === id ? { ...m, content: m.content + chunk } : m));
          if (done) { setMessages((all) => all.map((m) => m.id === id ? { ...m, complete: true } : m)); break; }
        }
      } finally { reader.releaseLock(); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The reply was interrupted. Please try again.');
    } finally { if (request.current === controller) { request.current = undefined; setBusy(false); } }
  };
  const turn = messages.find((m) => m.id === selectedTurn) ?? [...messages].reverse().find((m) => m.role === 'assistant');
  const paused = currentStudent?.states.find((s) => s.node_id === turn?.nodeId)?.paused;
  const bypass = async () => {
    if (!turn?.nodeId || bypassBusy) return;
    setBypassBusy(true); setBypassMessage('');
    try {
      const result = await api.bypass({ student_id: studentId, node_id: turn.nodeId });
      setBypassMessage(`Bypass applied · ${result.remaining_quota} left`);
      await profile.refresh();
      await data.refresh();
    } catch (err) { setBypassMessage(err instanceof ApiError && err.code === 'quota_exhausted' ? 'No bypasses left' : err instanceof Error ? err.message : 'Could not apply bypass. Try again.'); }
    finally { setBypassBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm('Reset all demo progress and remove custom trees?')) return;
    newChat(); setResetBusy(true);
    try { await api.demoReset({ full: true }); await profile.refresh(); await data.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reset the demo.'); }
    finally { setResetBusy(false); }
  };
  return <><TopBar title={data.bundle?.tree.title} live={data.live} treeId={student?.tree_id ?? undefined} /><main className="workspace sandbox-workspace"><div className="page-heading"><div><span className="eyebrow">SPACE TO FIGURE IT OUT</span><h1>A conversation that grows with you.</h1><p>Ask, explore, and see how Friction meets you where you are.</p></div></div>
    <div className="sandbox-layout"><section className="chat-section" aria-label="Sandbox chat"><div className="chat-toolbar"><label>Student<select aria-label="Sandbox student" value={studentId} disabled={busy || resetBusy || bypassBusy} onChange={(e) => { newChat(); setStudentId(e.target.value); }}>
      {!data.students.length && <option value={studentId}>{student?.user.name ?? 'Alex Chen'}</option>}{data.students.map((s) => <option key={s.user.id} value={s.user.id}>{s.user.name}</option>)}
    </select></label><div className="chat-tools">{demo && <button onClick={() => { void reset(); }} disabled={resetBusy || bypassBusy}><RotateCcw size={13} />Reset demo</button>}<button onClick={newChat} disabled={resetBusy || bypassBusy}><Plus size={14} />New chat</button></div></div>
    <div className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">{!messages.length && <div className="chat-welcome"><span className="welcome-icon"><MessageCircle size={30} /></span><h2>Start with a little curiosity.</h2><p>A question is a good place to begin.</p><button onClick={() => setText('How do I stop my useEffect from running in an infinite loop?')}>How do I fix an infinite useEffect loop? ↗</button></div>}
      {messages.map((message) => <article key={message.id} className={`chat-bubble ${message.role}`}><span className="bubble-author">{message.role === 'user' ? 'You' : 'Friction'}</span><div>{message.content || 'Thinking…'}</div>{message.role === 'assistant' && <button className="turn-details" onClick={() => setSelectedTurn(message.id)}>{message.level ? levelLabel(message.level) : 'No matched concept'} · View this turn</button>}</article>)}<div ref={scroll} /></div>
    {(error || profile.error || data.error) && <div className="error-banner" role="alert">{error || profile.error || data.error}<button onClick={() => { setError(''); void profile.refresh(); void data.refresh(); }}>Retry connection</button></div>}
    <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea aria-label="Chat message" rows={2} placeholder="Ask anything about your course…" value={text} disabled={busy || resetBusy || bypassBusy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} /><button className="primary-button" aria-label="Send message" disabled={busy || resetBusy || bypassBusy || !text.trim() || !student?.tree_id}><ArrowUp size={20} /></button></form><p className="chat-footnote">A little friction. A deeper understanding.</p>
    </section><aside className="turn-panel"><div className="turn-context"><span className="eyebrow">BEHIND THE CONVERSATION</span><h2>Friction for this turn</h2>{turn ? <><dl><div><dt>Concept</dt><dd>{turn.concept ?? (turn.nodeId ? 'Matched concept' : 'No matched concept')}</dd></div><div><dt>Level</dt><dd>{turn.level ? <span className={`level-chip ${turn.level === 4 ? 'normal-level' : ''}`}>{levelLabel(turn.level)}</span> : 'Normal assistance'}</dd></div><div><dt>Quiz</dt><dd>{turn.level && turn.level < 4 ? 'See check question in reply' : 'Not attached'}</dd></div></dl><details><summary>Show learning context</summary><p className="context-explanation">{turn.level ? `${levelLabel(turn.level)}${turn.concept ? ` for ${turn.concept}` : ''}.` : 'No concept matched this turn.'} Friction adjusts how much help you receive as you learn.</p></details></> : <p className="muted">Send a message to explore your learning context.</p>}
      <div className="sandbox-bypass"><button onClick={() => { void bypass(); }} disabled={!turn?.nodeId || busy || resetBusy || bypassBusy || paused}><ArrowUpRight size={15} />{bypassBusy ? 'Applying bypass…' : paused ? `Bypass active (${quota} left)` : `Use bypass (${quota} left)`}</button><p>{bypassMessage || 'Skip friction for this concept and let your educator know.'}</p></div></div>
      <div className="map-heading"><h3>Your learning map</h3><span><i />Updates live</span></div>{data.bundle ? <div className="mini-tree"><SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentId} /></div> : <div className="center-state"><p>{data.error || 'Loading your learning map…'}</p></div>}
    </aside></div>
  </main></>;
}
