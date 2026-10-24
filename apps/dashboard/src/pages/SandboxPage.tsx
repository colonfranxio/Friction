import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageCircle, Plus } from 'lucide-react';
import { CHAT_HEADERS, SEED_IDS, type BloomLevel, type ChatMessage, type StudentStateResponse } from '@friction/shared';
import { api } from '../lib/api';
import { useTreeData } from '../lib/useTreeData';
import { levelLabel } from '../lib/format';
import { TopBar } from '../panels/TopBar';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';

type Bubble = ChatMessage & { id: string; concept?: string; level?: BloomLevel; quiz?: boolean };
export function SandboxPage() {
  const [studentId, setStudentId] = useState<string>(SEED_IDS.demoStudent);
  const [student, setStudent] = useState<StudentStateResponse>();
  const [conversation, setConversation] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedTurn, setSelectedTurn] = useState<string>();
  const request = useRef<AbortController | undefined>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const data = useTreeData(student?.tree_id ?? undefined);
  useEffect(() => {
    let current = true;
    setStudent(undefined);
    api.getStudent(studentId).then((result) => { if (current) setStudent(result); }).catch((err) => { if (current) setError(String(err)); });
    return () => { current = false; request.current?.abort(); };
  }, [studentId]);
  useEffect(() => { scroll.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [messages]);
  const newChat = () => {
    request.current?.abort(); request.current = undefined;
    setBusy(false); setMessages([]); setConversation(crypto.randomUUID()); setSelectedTurn(undefined); setError('');
  };
  const send = async () => {
    if (!text.trim() || busy || !student?.tree_id) return;
    const controller = new AbortController(); request.current = controller;
    const raw = text.trim(); const id = crypto.randomUUID();
    const history: ChatMessage[] = [...messages.map(({ role, content }) => ({ role, content })), { role: 'user', content: raw }];
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
      setMessages((all) => [...all, { id, role: 'assistant', content: '', concept, level, quiz: undefined }]); setSelectedTurn(id);
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
          if (controller.signal.aborted) break;
          setMessages((all) => all.map((m) => m.id === id ? { ...m, content: m.content + chunk } : m));
          if (done) break;
        }
      } finally { reader.releaseLock(); }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The reply was interrupted. Please try again.');
    } finally { if (request.current === controller) { request.current = undefined; setBusy(false); } }
  };
  const turn = messages.find((m) => m.id === selectedTurn) ?? [...messages].reverse().find((m) => m.role === 'assistant');
  return <><TopBar title={data.bundle?.tree.title} live={data.live} treeId={student?.tree_id ?? undefined} /><main className="workspace sandbox-workspace"><div className="page-heading"><div><span className="eyebrow">SPACE TO FIGURE IT OUT</span><h1>A conversation that grows with you.</h1><p>Ask, explore, and see how Friction meets you where you are.</p></div></div>
    <div className="sandbox-layout"><section className="chat-section" aria-label="Sandbox chat"><div className="chat-toolbar"><label>Student<select aria-label="Sandbox student" value={studentId} disabled={busy} onChange={(e) => { newChat(); setStudentId(e.target.value); }}>
      {!data.students.length && <option value={studentId}>{student?.user.name ?? 'Alex Chen'}</option>}{data.students.map((s) => <option key={s.user.id} value={s.user.id}>{s.user.name}</option>)}
    </select></label><button onClick={newChat}><Plus size={14} />New chat</button></div>
    <div className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">{!messages.length && <div className="chat-welcome"><span className="welcome-icon"><MessageCircle size={30} /></span><h2>Start with a little curiosity.</h2><p>A question is a good place to begin.</p><button onClick={() => setText('How do I stop my useEffect from running in an infinite loop?')}>How do I fix an infinite useEffect loop? ↗</button></div>}
      {messages.map((message) => <article key={message.id} className={`chat-bubble ${message.role}`}><span className="bubble-author">{message.role === 'user' ? 'You' : 'Friction'}</span><div>{message.content || 'Thinking…'}</div>{message.role === 'assistant' && <button className="turn-details" onClick={() => setSelectedTurn(message.id)}>{message.level ? levelLabel(message.level) : 'No matched concept'} · View this turn</button>}</article>)}<div ref={scroll} /></div>
    {(error || data.error) && <div className="error-banner" role="alert">{error || data.error}<button onClick={() => { setError(''); void api.getStudent(studentId).then(setStudent).catch((err) => setError(String(err))); void data.refresh(); }}>Retry connection</button></div>}
    <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea aria-label="Chat message" rows={2} placeholder="Ask anything about your course…" value={text} disabled={busy} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} /><button className="primary-button" aria-label="Send message" disabled={busy || !text.trim() || !student?.tree_id}><ArrowUp size={20} /></button></form><p className="chat-footnote">A little friction. A deeper understanding.</p>
    </section><aside className="turn-panel"><span className="eyebrow">BEHIND THE CONVERSATION</span><h2>Friction for this turn</h2>{turn ? <><dl><dt>Concept</dt><dd>{turn.concept ?? 'No matched concept'}</dd><dt>Level</dt><dd>{turn.level ? <span className="level-chip">{levelLabel(turn.level)}</span> : 'Normal assistance'}</dd><dt>Quiz</dt><dd>{turn.level && turn.level < 4 ? 'May be attached · see reply' : 'Not attached'}</dd></dl><details><summary>Show learning context</summary><p className="context-explanation">{turn.level ? `${levelLabel(turn.level)}${turn.concept ? ` for ${turn.concept}` : ''}.` : 'No concept matched this turn.'} Friction adjusts how much help you receive as you learn.</p></details></> : <p className="muted">Send a message to explore your learning context.</p>}
      <h3 className="mini-tree-title">Your learning map</h3>{data.bundle && <div className="mini-tree"><SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentId} /></div>}
    </aside></div>
  </main></>;
}
