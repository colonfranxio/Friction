/**
 * Mock API (lead-owned). Serves the full contract from packages/shared on MOCK_PORT (8788),
 * using in-memory seed data and the shared fakes. No dependencies beyond node:http.
 *
 * Who uses it:
 *  - C (dashboard) and D (extension) develop against it until A's real API is merged.
 *  - A uses it as a READABLE REFERENCE for the /intercept algorithm (docs/contracts.md §4).
 *  - scripts/smoke.ts can run against it: pnpm smoke:mock
 *
 * Run: pnpm dev:mock          (port 8788, used by C)
 *      pnpm dev:mock:ext      (port 8789, Agent D's private instance)
 */
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  CHAT_HEADERS,
  CONTRACT_VERSION,
  DEFAULT_BYPASS_QUOTA,
  DEMO_PARSE_DELAY_MS,
  INTERCEPT_BUDGET_MS,
  PORTS,
  QUIZ_WINDOW_MS,
  buildSeed,
  fakeIntelligence,
  wouldCreateCycle,
  type ActivityItem,
  type BloomLevel,
  type BypassEvent,
  type ChatLog,
  type ChatRequest,
  type CreateEdgeRequest,
  type CreateNodeRequest,
  type DemoResetRequest,
  type ErrorCode,
  type EvaluationResult,
  type HeartbeatRequest,
  type InterceptRequest,
  type InterceptResponse,
  type ParseTreeRequest,
  type ResponsesRequest,
  type SeedData,
  type ServerEvent,
  type SkillNode,
  type StudentNodeState,
  type UpdateNodeRequest,
  type UUID,
  type BypassRequest,
  type RenamePillarRequest,
} from '@friction/shared';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
// Port: --port flag (cross-platform) > MOCK_PORT env > 8788
const PORT = Number(argValue('--port') ?? process.env.MOCK_PORT ?? PORTS.mock);
const DEMO = (process.env.DEMO_MODE ?? '1') === '1';
const intel = fakeIntelligence;

// ---------------- in-memory store ----------------
interface DB extends SeedData {
  logs: ChatLog[];
  bypasses: BypassEvent[];
}
let db: DB = fresh();
function fresh(): DB {
  return { ...buildSeed(), logs: [], bypasses: [] };
}
const now = () => new Date().toISOString();

const user = (id: UUID) => db.users.find((u) => u.id === id);
const nodeById = (id: UUID) => db.nodes.find((n) => n.id === id);
const stateOf = (student: UUID, node: UUID) =>
  db.states.find((s) => s.student_id === student && s.node_id === node);

// ---------------- SSE bus ----------------
const clients = new Set<{ res: ServerResponse; treeId: UUID }>();
function emit(treeId: UUID, ev: ServerEvent) {
  for (const c of clients) {
    if (c.treeId !== treeId) continue;
    c.res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`);
  }
}
setInterval(() => clients.forEach((c) => c.res.write(': ping\n\n')), 15000).unref();

// ---------------- helpers ----------------
class HttpError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string) {
    super(message);
  }
}
const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);

function activityFromLog(log: ChatLog, kind: ActivityItem['kind']): ActivityItem {
  return {
    id: log.id,
    kind,
    student_id: log.student_id,
    student_name: user(log.student_id)?.name ?? '?',
    node_id: log.node_id,
    concept_name: nodeById(log.node_id)?.concept_name ?? '?',
    level: log.level,
    verdict: log.verdict,
    confidence: log.confidence,
    rationale: log.rationale,
    created_at: log.created_at,
  };
}

/** Resolves within `ms` or returns {done:false}; the promise keeps running either way. */
async function race<T>(p: Promise<T>, ms: number): Promise<{ done: true; value: T } | { done: false }> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<{ done: false }>((r) => (t = setTimeout(() => r({ done: false }), ms)));
  const out = await Promise.race([p.then((value) => ({ done: true as const, value })), timeout]);
  clearTimeout(t);
  return out;
}

function setLevel(state: StudentNodeState, level: BloomLevel, treeId: UUID) {
  if (state.paused || state.current_blooms_level === level) return;
  state.current_blooms_level = level;
  state.updated_at = now();
  emit(treeId, { type: 'student_state', data: state });
}

// ---------------- /intercept: the reference algorithm (docs/contracts.md §4) ----------------
async function intercept(req: InterceptRequest): Promise<InterceptResponse> {
  const u = user(req.student_id);
  if (!u) throw notFound('student');
  if (!u.active_tree_id) throw new HttpError(400, 'bad_request', 'student has no active tree');
  const treeId = u.active_tree_id;
  const nodes = db.nodes.filter((n) => n.tree_id === treeId);
  const passthrough: InterceptResponse = {
    intercept_id: null, node_id: null, level: null, injected_prompt: req.raw_prompt, quiz_attached: false, graded: null,
  };

  // Step 1: find a pending quiz (same conversation, or latest within the window if no conversation id).
  const pending = [...db.logs]
    .reverse()
    .find(
      (l) =>
        l.student_id === u.id &&
        l.quiz_pending &&
        nodes.some((n) => n.id === l.node_id) &&
        (req.conversation_id
          ? l.conversation_id === req.conversation_id
          : Date.now() - Date.parse(l.created_at) < QUIZ_WINDOW_MS),
    );

  // Step 2: classification and grading in parallel, inside the budget.
  const classifyP = pending ? Promise.resolve(null) : intel.classifyTopic(req.raw_prompt, nodes);
  const pendingNode = pending ? nodeById(pending.node_id) : undefined;
  const pendingState = pending ? stateOf(u.id, pending.node_id) : undefined;
  let gradeP: Promise<EvaluationResult> | null = null;
  if (pending && pendingNode && pendingState && !pendingState.paused) {
    gradeP = intel.evaluateExchange({
      node: pendingNode,
      level: pendingState.current_blooms_level,
      quiz_text: pending.llm_response ?? req.previous_assistant_text ?? null,
      student_message: req.raw_prompt,
      demoMode: DEMO,
    });
  }
  const applyGrade = (r: EvaluationResult) => {
    if (!pending || !pendingState) return;
    pending.verdict = r.verdict;
    pending.confidence = r.confidence;
    pending.rationale = r.rationale;
    if (r.verdict !== 'not_an_answer') pending.quiz_pending = false;
    setLevel(pendingState, r.new_level, treeId);
    emit(treeId, { type: 'activity', data: activityFromLog(pending, 'graded') });
  };
  const [cls, grade] = await Promise.all([
    race(classifyP, INTERCEPT_BUDGET_MS),
    gradeP ? race(gradeP, INTERCEPT_BUDGET_MS) : Promise.resolve(null),
  ]);
  if (grade?.done) applyGrade(grade.value);
  else if (gradeP) gradeP.then(applyGrade).catch(() => {}); // late grade still applies (rule 4.6)

  // Step 3: resolve the node: pending quiz > classification > conversation stickiness > none.
  const classifiedId = cls.done ? cls.value?.node_id ?? null : null;
  const stickyId = req.conversation_id
    ? [...db.logs].reverse().find((l) => l.student_id === u.id && l.conversation_id === req.conversation_id)?.node_id ?? null
    : null;
  const nodeId = pending?.node_id ?? classifiedId ?? stickyId;
  const node = nodeId ? nodeById(nodeId) : undefined;
  if (!node) return passthrough;

  // Step 4: level + quiz + prompt.
  const state = stateOf(u.id, node.id);
  if (!state) throw notFound('student_state');
  const level: BloomLevel = state.paused ? 4 : state.current_blooms_level;
  const quizStillOpen = db.logs.some((l) => l.student_id === u.id && l.node_id === node.id && l.quiz_pending);
  const includeQuiz = level < 4 && !quizStillOpen;
  const feedback = grade?.done ? { verdict: grade.value.verdict } : null;
  const injected = intel.buildFrictionPrompt({ raw_prompt: req.raw_prompt, level, node, includeQuiz, feedback });

  // Step 5: log.
  const log: ChatLog = {
    id: randomUUID(),
    student_id: u.id,
    node_id: node.id,
    conversation_id: req.conversation_id,
    app_source: req.app_source,
    level,
    raw_prompt: req.raw_prompt,
    injected_prompt: injected,
    llm_response: null,
    quiz_pending: includeQuiz,
    verdict: null,
    confidence: null,
    rationale: null,
    created_at: now(),
  };
  db.logs.push(log);
  emit(treeId, { type: 'activity', data: activityFromLog(log, 'intercept') });

  return {
    intercept_id: log.id,
    node_id: node.id,
    level,
    injected_prompt: injected,
    quiz_attached: includeQuiz,
    graded: grade?.done
      ? { verdict: grade.value.verdict, confidence: grade.value.confidence, new_level: grade.value.new_level }
      : null,
  };
}

// ---------------- routing ----------------
type Handler = (ctx: { params: Record<string, string>; body: any; query: URLSearchParams; res: ServerResponse }) => Promise<unknown>;
const routes: Array<{ method: string; re: RegExp; keys: string[]; h: Handler }> = [];
function route(method: string, path: string, h: Handler) {
  const keys: string[] = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, re, keys, h });
}

route('GET', '/health', async () => ({
  ok: true, contract_version: CONTRACT_VERSION, mode: { intelligence: 'fake', demo: DEMO, server: 'mock' },
}));

route('POST', '/trees/parse', async ({ body }) => {
  const b = body as ParseTreeRequest;
  if (!b || (b.kind !== 'pdf' && b.kind !== 'text')) throw new HttpError(400, 'bad_request', 'kind must be pdf or text');
  // Mock behaves like DEMO_MODE cache hit for any input: reset demo state and return the seed tree.
  await new Promise((r) => setTimeout(r, DEMO_PARSE_DELAY_MS));
  db = fresh();
  return { tree_id: db.trees[0].id, cached: true };
});

route('GET', '/trees/:treeId', async ({ params }) => {
  const tree = db.trees.find((t) => t.id === params.treeId);
  if (!tree) throw notFound('tree');
  return {
    tree,
    pillars: db.pillars.filter((p) => p.tree_id === tree.id).sort((a, b) => a.order - b.order),
    nodes: db.nodes.filter((n) => n.tree_id === tree.id),
    edges: db.edges.filter((e) => e.tree_id === tree.id),
  };
});

route('POST', '/trees/:treeId/nodes', async ({ params, body }) => {
  const b = body as CreateNodeRequest;
  if (!db.trees.some((t) => t.id === params.treeId)) throw notFound('tree');
  if (!b?.concept_name || !b.pillar_id) throw new HttpError(400, 'bad_request', 'concept_name and pillar_id required');
  const n: SkillNode = {
    id: randomUUID(), tree_id: params.treeId, pillar_id: b.pillar_id, concept_name: b.concept_name,
    mastery_criteria: b.mastery_criteria ?? '', required_blooms_level: b.required_blooms_level ?? 4,
    size: b.size ?? 'minor', icon: b.icon ?? 'circle', keywords: b.keywords ?? [], position: b.position ?? null,
  };
  db.nodes.push(n);
  for (const u of db.users.filter((x) => x.role === 'student' && x.active_tree_id === params.treeId)) {
    db.states.push({ student_id: u.id, node_id: n.id, current_blooms_level: 1, paused: false, updated_at: now() });
  }
  emit(params.treeId, { type: 'tree_updated', data: { tree_id: params.treeId } });
  return n;
});

route('PATCH', '/nodes/:nodeId', async ({ params, body }) => {
  const n = nodeById(params.nodeId);
  if (!n) throw notFound('node');
  const b = body as UpdateNodeRequest;
  Object.assign(n, b, { id: n.id, tree_id: n.tree_id });
  emit(n.tree_id, { type: 'tree_updated', data: { tree_id: n.tree_id } });
  return n;
});

route('DELETE', '/nodes/:nodeId', async ({ params }) => {
  const n = nodeById(params.nodeId);
  if (!n) throw notFound('node');
  db.nodes = db.nodes.filter((x) => x.id !== n.id);
  db.edges = db.edges.filter((e) => e.parent_node_id !== n.id && e.child_node_id !== n.id);
  db.states = db.states.filter((s) => s.node_id !== n.id);
  emit(n.tree_id, { type: 'tree_updated', data: { tree_id: n.tree_id } });
  return undefined;
});

route('POST', '/edges', async ({ body }) => {
  const b = body as CreateEdgeRequest;
  const p = nodeById(b?.parent_node_id), c = nodeById(b?.child_node_id);
  if (!p || !c) throw notFound('node');
  if (p.tree_id !== c.tree_id) throw new HttpError(400, 'bad_request', 'nodes are in different trees');
  const exists = db.edges.find((e) => e.parent_node_id === p.id && e.child_node_id === c.id);
  if (exists) return exists;
  if (wouldCreateCycle(db.edges, p.id, c.id)) throw new HttpError(409, 'cycle', 'edge would create a cycle');
  const e = { tree_id: p.tree_id, parent_node_id: p.id, child_node_id: c.id };
  db.edges.push(e);
  emit(p.tree_id, { type: 'tree_updated', data: { tree_id: p.tree_id } });
  return e;
});

route('DELETE', '/edges/:parentId/:childId', async ({ params }) => {
  const e = db.edges.find((x) => x.parent_node_id === params.parentId && x.child_node_id === params.childId);
  if (!e) throw notFound('edge');
  db.edges = db.edges.filter((x) => x !== e);
  emit(e.tree_id, { type: 'tree_updated', data: { tree_id: e.tree_id } });
  return undefined;
});

route('PATCH', '/pillars/:pillarId', async ({ params, body }) => {
  const p = db.pillars.find((x) => x.id === params.pillarId);
  if (!p) throw notFound('pillar');
  const b = body as RenamePillarRequest;
  if (!b?.name) throw new HttpError(400, 'bad_request', 'name required');
  p.name = b.name;
  emit(p.tree_id, { type: 'tree_updated', data: { tree_id: p.tree_id } });
  return p;
});

route('GET', '/trees/:treeId/students', async ({ params }) => {
  const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === params.treeId).map((n) => n.id));
  return {
    students: db.users
      .filter((u) => u.role === 'student' && u.active_tree_id === params.treeId)
      .map((u) => ({ user: u, states: db.states.filter((s) => s.student_id === u.id && nodeIds.has(s.node_id)) })),
  };
});

route('GET', '/trees/:treeId/activity', async ({ params }) => {
  const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === params.treeId).map((n) => n.id));
  const items: ActivityItem[] = [
    ...db.logs.filter((l) => nodeIds.has(l.node_id)).map((l) => activityFromLog(l, l.verdict ? 'graded' : 'intercept')),
    ...db.bypasses.filter((b) => nodeIds.has(b.node_id)).map<ActivityItem>((b) => ({
      id: b.id, kind: 'bypass', student_id: b.student_id, student_name: user(b.student_id)?.name ?? '?',
      node_id: b.node_id, concept_name: nodeById(b.node_id)?.concept_name ?? '?', level: 4,
      verdict: null, confidence: null, rationale: null, created_at: b.created_at,
    })),
  ];
  return { items: items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50) };
});

route('GET', '/students/:studentId', async ({ params }) => {
  const u = user(params.studentId);
  if (!u) throw notFound('student');
  const nodeIds = new Set(db.nodes.filter((n) => n.tree_id === u.active_tree_id).map((n) => n.id));
  return { user: u, tree_id: u.active_tree_id, states: db.states.filter((s) => s.student_id === u.id && nodeIds.has(s.node_id)) };
});

route('POST', '/intercept', async ({ body }) => {
  const b = body as InterceptRequest;
  if (!b?.student_id || typeof b.raw_prompt !== 'string') throw new HttpError(400, 'bad_request', 'student_id and raw_prompt required');
  return intercept({ ...b, conversation_id: b.conversation_id ?? null });
});

route('POST', '/responses', async ({ body, res }) => {
  const b = body as ResponsesRequest;
  const log = db.logs.find((l) => l.id === b?.intercept_id);
  if (!log) throw notFound('intercept');
  log.llm_response = b.llm_response;
  res.statusCode = 202;
  return { ok: true };
});

route('POST', '/bypass', async ({ body }) => {
  const b = body as BypassRequest;
  const u = user(b?.student_id);
  const n = nodeById(b?.node_id);
  if (!u || !n) throw notFound('student or node');
  if (u.bypass_quota <= 0) throw new HttpError(409, 'quota_exhausted', 'no bypasses left');
  const s = stateOf(u.id, n.id);
  if (!s) throw notFound('student_state');
  u.bypass_quota -= 1;
  s.paused = true;
  s.updated_at = now();
  db.logs.forEach((l) => { if (l.student_id === u.id && l.node_id === n.id) l.quiz_pending = false; });
  const ev: BypassEvent = { id: randomUUID(), student_id: u.id, node_id: n.id, remaining_quota: u.bypass_quota, created_at: now() };
  db.bypasses.push(ev);
  emit(n.tree_id, { type: 'student_state', data: s });
  emit(n.tree_id, { type: 'bypass', data: { ...ev, student_name: u.name, concept_name: n.concept_name } });
  return { remaining_quota: u.bypass_quota };
});

route('POST', '/heartbeat', async ({ body }) => {
  const b = body as HeartbeatRequest;
  const u = user(b?.student_id);
  if (!u) throw notFound('student');
  u.last_seen_at = now();
  if (u.active_tree_id) emit(u.active_tree_id, { type: 'student_seen', data: { student_id: u.id, last_seen_at: u.last_seen_at, enabled: b.enabled } });
  return undefined;
});

route('POST', '/demo/reset', async ({ body }) => {
  if (!DEMO) throw new HttpError(404, 'demo_only', 'DEMO_MODE is off');
  const b = (body ?? {}) as DemoResetRequest;
  if (b.full || !b.student_id) {
    db = fresh();
  } else {
    const seed = buildSeed();
    const u = user(b.student_id);
    if (!u) throw notFound('student');
    u.bypass_quota = seed.users.find((x) => x.id === u.id)?.bypass_quota ?? DEFAULT_BYPASS_QUOTA;
    db.states = db.states.filter((s) => s.student_id !== u.id).concat(seed.states.filter((s) => s.student_id === u.id));
    db.logs = db.logs.filter((l) => l.student_id !== u.id);
  }
  // Clients refetch tree + students on tree_updated.
  for (const t of db.trees) emit(t.id, { type: 'tree_updated', data: { tree_id: t.id } });
  return { ok: true };
});

// ---------------- server ----------------
async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'bad_request', 'invalid JSON'); }
}

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Expose-Headers', Object.values(CHAT_HEADERS).join(', '));
}

createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();

  try {
    // SSE
    if (req.method === 'GET' && url.pathname === '/events') {
      const treeId = url.searchParams.get('tree_id');
      if (!treeId) throw new HttpError(400, 'bad_request', 'tree_id required');
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      const c = { res, treeId };
      clients.add(c);
      req.on('close', () => clients.delete(c));
      return;
    }

    // Streaming sandbox chat
    if (req.method === 'POST' && url.pathname === '/chat') {
      const b = (await readBody(req)) as ChatRequest;
      const lastUser = [...(b?.messages ?? [])].reverse().find((m) => m.role === 'user');
      if (!b?.student_id || !lastUser) throw new HttpError(400, 'bad_request', 'student_id and a user message required');
      const ic = await intercept({ student_id: b.student_id, raw_prompt: lastUser.content, app_source: 'sandbox', conversation_id: b.conversation_id ?? null });
      const msgs = b.messages.map((m) => (m === lastUser ? { ...m, content: ic.injected_prompt } : m));
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        [CHAT_HEADERS.interceptId]: ic.intercept_id ?? '',
        [CHAT_HEADERS.nodeId]: ic.node_id ?? '',
        [CHAT_HEADERS.level]: ic.level ? String(ic.level) : '',
      });
      let full = '';
      for await (const chunk of intel.chat(msgs)) { full += chunk; res.write(chunk); }
      res.end();
      const log = db.logs.find((l) => l.id === ic.intercept_id);
      if (log) log.llm_response = full;
      return;
    }

    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) throw notFound(`route ${req.method} ${url.pathname}`);
    const m = r.re.exec(url.pathname)!;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await readBody(req);
    const out = await r.h({ params, body, query: url.searchParams, res });
    if (out === undefined) return void res.writeHead(204).end();
    if (!res.statusCode || res.statusCode === 200) res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (e) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'internal', String((e as Error)?.message ?? e));
    if (!res.headersSent) res.writeHead(err.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: err.code, message: err.message } }));
  }
}).listen(PORT, () => {
  console.log(`[mock-api] contract v${CONTRACT_VERSION} on http://127.0.0.1:${PORT} (DEMO_MODE=${DEMO ? 1 : 0})`);
});
