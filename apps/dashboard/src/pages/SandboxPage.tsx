import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, MessageCircle, Plus, RotateCcw } from 'lucide-react';
import { ApiError, SEED_IDS, type ChatMessage } from '@friction/shared';
import { api } from '../lib/api';
import { deliveredHistory, quizLabel, turnMetadata, type ChatBubble } from '../lib/chat';
import { useTreeData } from '../lib/useTreeData';
import { useStudentData } from '../lib/useStudentData';
import { levelLabel } from '../lib/format';
import { TopBar } from '../panels/TopBar';
import { SkillTreeCanvas } from '../tree/SkillTreeCanvas';

export function SandboxPage() {
  const [studentId, setStudentId] = useState<string>(SEED_IDS.demoStudent);
  const profile = useStudentData(studentId);
  const student = profile.student;
  const data = useTreeData(student?.tree_id ?? undefined);
  const [conversation, setConversation] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [failedPrompt, setFailedPrompt] = useState('');
  const [selectedTurn, setSelectedTurn] = useState<string>();
  const [bypassBusy, setBypassBusy] = useState(false);
  const [bypassMessage, setBypassMessage] = useState('');
  const [demo, setDemo] = useState(false);
  const [promptBypass, setPromptBypass] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const operation = useRef<string | undefined>(undefined);
  const session = useRef(0);
  const draft = useRef('');
  const lastTree = useRef<string | null | undefined>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  const writeDraft = (value: string) => { draft.current = value; setText(value); };
  const currentStudent = data.students.find((person) => person.user.id === studentId);
  const quota = currentStudent?.user.bypass_quota ?? student?.user.bypass_quota ?? 0;
  const latest = [...messages].reverse().find((message) => message.role === 'assistant');
  const turn = messages.find((message) => message.id === selectedTurn) ?? latest;
  const prompt = messages.find((message) => message.id === turn?.promptId);
  const paused = currentStudent?.states.find((state) => state.node_id === turn?.nodeId)?.paused;

  useEffect(() => { if (data.live || data.treeRevision) void profile.refresh(); }, [data.live, data.treeRevision, profile.refresh]);
  useEffect(() => {
    let current = true;
    api.health().then((health) => {
      if (!current) return;
      setDemo(health.mode.demo);
      // A v4 version alone does not certify the real endpoint's rollout.
      const readySha = import.meta.env.VITE_PROMPT_BYPASS_API_READY_SHA ?? '';
      setPromptBypass(health.contract_version >= 4 && (health.mode.server === 'mock' || /^[a-f0-9]{40}$/i.test(readySha)));
    }).catch(() => {});
    return () => { current = false; };
  }, []);
  useEffect(() => () => { session.current++; request.current?.abort(); }, [studentId]);
  useEffect(() => {
    if (student && lastTree.current !== student.tree_id) {
      if (lastTree.current !== undefined) newChat();
      lastTree.current = student.tree_id;
    }
  }, [student?.tree_id]);
  useEffect(() => { scroll.current?.scrollIntoView({ block: 'end', behavior: 'instant' }); }, [messages]);

  function newChat() {
    session.current++; request.current?.abort(); request.current = undefined; operation.current = undefined;
    setBusy(false); setBypassBusy(false); setMessages([]); setConversation(crypto.randomUUID()); setSelectedTurn(undefined);
    setError(''); setFailedPrompt(''); setBypassMessage(''); writeDraft('');
  }

  async function streamReply(raw: string, promptId: string, history: ChatMessage[], token?: string) {
    const controller = new AbortController();
    request.current = controller;
    const sessionId = session.current;
    const id = crypto.randomUUID();
    let received = false;
    setBusy(true); setError(''); setFailedPrompt('');
    try {
      const response = await api.chat({ student_id: studentId, conversation_id: conversation,
        messages: [...history, { role: 'user', content: raw }],
        ...(token ? { prompt_bypass_token: token } : {}),
      }, controller.signal);
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.error?.message ?? `Chat is unavailable (${response.status}).`);
      }
      if (!response.body) throw new Error('The reply stream was empty.');
      if (controller.signal.aborted || session.current !== sessionId) return;
      const metadata = turnMetadata(response.headers);
      const concept = data.bundle?.nodes.find((node) => node.id === metadata.nodeId)?.concept_name;
      setMessages((all) => [...all, { id, promptId, createdAt: Date.now(), role: 'assistant', content: '', concept, ...metadata, status: 'streaming', bypassAttempted: !!token }]);
      setSelectedTurn(id);
      received = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (controller.signal.aborted || session.current !== sessionId) return;
          const chunk = done ? decoder.decode() : decoder.decode(value, { stream: true });
          full += chunk;
          setMessages((all) => all.map((message) => message.id === id ? { ...message, content: message.content + chunk } : message));
          if (done) {
            if (!full.trim()) throw new Error('The reply stream was empty.');
            setMessages((all) => all.map((message) => message.id === id ? { ...message, status: 'complete' } : message));
            break;
          }
        }
      } finally { reader.releaseLock(); }
    } catch (err) {
      if (!controller.signal.aborted && session.current === sessionId) {
        if (received) setMessages((all) => all.map((message) => message.id === id ? { ...message, status: 'interrupted' } : message));
        setFailedPrompt(raw);
        setError(received ? 'Reply interrupted. Partial text is kept. Start a new chat or edit your original question; do not answer an unseen check question.' : err instanceof Error ? err.message : 'Could not get a reply.');
      }
    } finally {
      if (request.current === controller) { request.current = undefined; setBusy(false); }
    }
  }

  async function send() {
    if (!draft.current.trim() || operation.current || busy || resetBusy || bypassBusy || !student?.tree_id) return;
    const raw = draft.current;
    const id = crypto.randomUUID();
    operation.current = id;
    setMessages((all) => [...all, { id, role: 'user', content: raw, createdAt: Date.now() }]);
    writeDraft('');
    try { await streamReply(raw, id, deliveredHistory(messages)); }
    finally { if (operation.current === id) operation.current = undefined; }
  }

  const eligiblePrompt = !!(turn && prompt && turn.id === latest?.id && messages.at(-1)?.id === turn.id &&
    turn.status === 'complete' && !turn.bypassAttempted && !text.trim() && Date.now() - prompt.createdAt < 120_000);
  async function bypass() {
    if (!turn?.nodeId || operation.current || busy || resetBusy || bypassBusy || draft.current.trim()) return;
    if (promptBypass && !eligiblePrompt) return;
    if (promptBypass && (!prompt || Date.now() - prompt.createdAt >= 120_000)) { setBypassMessage('This question expired. Send a fresh question before using a bypass.'); return; }
    const id = crypto.randomUUID();
    const sessionId = session.current;
    operation.current = id; setBypassBusy(true); setBypassMessage('');
    try {
      // Mark before issuance: ambiguous network failures must never auto-charge again.
      if (promptBypass) setMessages((all) => all.map((message) => message.id === turn.id ? { ...message, bypassAttempted: true } : message));
      const result = await api.bypass({ student_id: studentId, node_id: turn.nodeId,
        ...(promptBypass && prompt ? { scope: 'prompt' as const, raw_prompt: prompt.content, conversation_id: conversation } : {}),
      });
      if (session.current !== sessionId) return;
      setBypassMessage(`Bypass applied · ${result.remaining_quota} left${promptBypass ? ' · this prompt only' : ' · concept paused'}`);
      if (promptBypass && prompt) {
        if (!result.prompt_bypass_token) {
          setBypassMessage(`No resend authorization returned. ${result.remaining_quota} bypasses left; nothing resent. Start a new chat before continuing.`);
        } else if (!draft.current.trim() && Date.now() - prompt.createdAt < 120_000 && operation.current === id) {
          const beforePrompt = messages.slice(0, messages.findIndex((message) => message.id === prompt.id));
          setMessages((all) => all.map((message) => message.id === turn.id ? { ...message, status: 'superseded' } : message));
          await streamReply(prompt.content, prompt.id, deliveredHistory(beforePrompt), result.prompt_bypass_token);
        } else setBypassMessage(`Bypass charged · ${result.remaining_quota} left. The question changed or expired; nothing resent.`);
      }
      if (session.current !== sessionId) return;
      await profile.refresh(); await data.refresh();
    } catch (err) {
      if (session.current === sessionId) setBypassMessage(err instanceof ApiError && err.code === 'quota_exhausted' ? 'No bypasses left' : err instanceof Error ? err.message : 'Bypass outcome unknown. Nothing resent; do not retry automatically.');
    } finally {
      if (session.current === sessionId) setBypassBusy(false);
      if (operation.current === id) operation.current = undefined;
    }
  }

  async function reset() {
    if (operation.current || !window.confirm('Reset all demo progress and remove custom trees?')) return;
    newChat(); setResetBusy(true); operation.current = 'reset';
    try { await api.demoReset({ full: true }); await profile.refresh(); await data.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reset the demo.'); }
    finally { operation.current = undefined; setResetBusy(false); }
  }

  const locked = busy || resetBusy || bypassBusy;
  const canBypass = !!turn?.nodeId && !locked && !text.trim() && (promptBypass ? eligiblePrompt : !paused);
  return <>
    <TopBar title={data.bundle?.tree.title} live={data.live} treeId={student?.tree_id ?? undefined} />
    <main className="workspace sandbox-workspace">
      <div className="page-heading"><div><span className="eyebrow">SPACE TO FIGURE IT OUT</span><h1>A conversation that grows with you.</h1><p>Ask, explore, and see how Friction meets you where you are.</p></div></div>
      <div className="sandbox-layout">
        <section className="chat-section" aria-label="Sandbox chat">
          <div className="chat-toolbar">
            <label>Student<select aria-label="Sandbox student" value={studentId} disabled={locked} onChange={(event) => { newChat(); setStudentId(event.target.value); }}>
              {!data.students.length && <option value={studentId}>{student?.user.name ?? 'Alex Chen'}</option>}
              {data.students.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name}</option>)}
            </select></label>
            <div className="chat-tools">{demo && <button onClick={() => { void reset(); }} disabled={locked}><RotateCcw size={13} />Reset demo</button>}<button onClick={newChat} disabled={resetBusy}><Plus size={14} />New chat</button></div>
          </div>
          <div className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">
            {!messages.length && <div className="chat-welcome"><span className="welcome-icon"><MessageCircle size={30} /></span><h2>Start with a little curiosity.</h2><p>A question is a good place to begin.</p><button onClick={() => writeDraft('How do I stop my useEffect from running in an infinite loop?')}>How do I fix an infinite useEffect loop? ↗</button></div>}
            {messages.map((message) => <article key={message.id} className={`chat-bubble ${message.role}`} data-reply-status={message.status}>
              <span className="bubble-author">{message.role === 'user' ? 'You' : 'Friction'}</span>
              <div>{message.content || (message.status === 'interrupted' ? 'No reply delivered.' : 'Thinking…')}</div>
              {message.role === 'assistant' && <>
                <span className="reply-outcome">{message.status === 'streaming' ? 'Replying…' : message.status === 'interrupted' ? 'Interrupted · partial reply' : message.status === 'superseded' ? 'Replaced by prompt bypass' : 'Reply complete'}</span>
                <button className="turn-details" disabled={bypassBusy} onClick={() => setSelectedTurn(message.id)}>{message.level ? levelLabel(message.level) : 'No matched concept'} · View this turn</button>
              </>}
            </article>)}<div ref={scroll} />
          </div>
          {(error || profile.error || data.error) && <div className="error-banner" role="alert"><span>{error || profile.error || data.error}</span>{failedPrompt ? <button disabled={locked} onClick={() => { writeDraft(failedPrompt); setError(''); }}>Edit original question</button> : <button onClick={() => { void profile.refresh(); void data.refresh(); }}>Retry connection</button>}</div>}
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea aria-label="Chat message" rows={2} placeholder="Ask anything about your course…" value={text} disabled={locked} onChange={(event) => writeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
            <button className="primary-button" aria-label="Send message" disabled={locked || !text.trim() || !student?.tree_id}><ArrowUp size={20} /></button>
          </form><p className="chat-footnote">A little friction. A deeper understanding.</p>
        </section>
        <aside className="turn-panel">
          <div className="turn-context"><span className="eyebrow">BEHIND THE CONVERSATION</span><h2>Friction for this turn</h2>
            {turn ? <>
              <dl><div><dt>Concept</dt><dd>{turn.concept ?? (turn.nodeId ? 'Matched concept' : 'No matched concept')}</dd></div><div><dt>Level</dt><dd>{turn.level ? <span className={`level-chip ${turn.level === 4 ? 'normal-level' : ''}`}>{levelLabel(turn.level)}</span> : 'Normal assistance'}</dd></div><div><dt>Quiz</dt><dd data-quiz-attached={turn.quizAttached === undefined ? 'unknown' : String(turn.quizAttached)}>{quizLabel(turn)}</dd></div></dl>
              <details><summary>Show learning context</summary><p className="context-explanation">{turn.level ? `${levelLabel(turn.level)}${turn.concept ? ` for ${turn.concept}` : ''}.` : 'No concept matched this turn.'} Friction adjusts how much help you receive as you learn.</p></details>
            </> : <p className="muted">Send a message to explore your learning context.</p>}
            <div className="sandbox-bypass"><button onClick={() => { void bypass(); }} disabled={!canBypass}><ArrowUpRight size={15} />{bypassBusy ? 'Applying bypass…' : !promptBypass && paused ? `Bypass active (${quota} left)` : `Use bypass (${quota} left)`}</button><p role="status">{bypassMessage || (promptBypass ? `Resend the latest question once without friction${turn?.concept ? ` for ${turn.concept}` : ''}. Your mastery stays unchanged. Clear any draft first.` : 'Pause friction for this concept until reset. One-prompt bypass is not enabled on this server.')}</p></div>
          </div>
          <div className="map-heading"><h3>Your learning map</h3><span><i />Updates live</span></div>
          {data.bundle ? <div className="mini-tree"><SkillTreeCanvas bundle={data.bundle} students={data.students} studentId={studentId} /></div> : <div className="center-state"><p>{data.error || 'Loading your learning map…'}</p></div>}
        </aside>
      </div>
    </main>
  </>;
}
