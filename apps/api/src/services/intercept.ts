/**
 * The /intercept hot path (docs/contracts.md §4), ported from scripts/mock-api.ts.
 * Resilience rules on top of the mock: classify failure = no match; grade failure = quiz stays
 * pending and the level doesn't change; a grade that misses the budget still applies when it lands.
 */
import { randomUUID } from 'node:crypto';
import type {
  BloomLevel,
  ChatLog,
  ClassifyResult,
  EvaluationResult,
  InterceptRequest,
  InterceptResponse,
  StudentNodeState,
  UUID,
} from '@friction/shared';
import { QUIZ_WINDOW_MS } from '@friction/shared';
import type { Ctx } from '../context';
import { HttpError, notFound } from '../errors';
import { race } from '../lib/mutex';
import { activityFromLog } from './activity';

export type InterceptService = (req: InterceptRequest) => Promise<InterceptResponse>;

const NO_MATCH: ClassifyResult = { node_id: null, confidence: 0, method: 'none' };
const now = () => new Date().toISOString();

/** Wraps a promise so we know how long it took to settle (ms) and never reject. */
function timed<T>(p: Promise<T>): { p: Promise<T | null>; ms: () => number | null } {
  const t0 = Date.now();
  let took: number | null = null;
  return {
    p: p.then(
      (v) => ((took = Date.now() - t0), v),
      (e) => {
        took = Date.now() - t0;
        console.error('[intercept] intelligence call failed:', (e as Error)?.message ?? e);
        return null;
      },
    ),
    ms: () => took,
  };
}

export function createInterceptService(ctx: Pick<Ctx, 'config' | 'intel' | 'store' | 'bus' | 'mutex'>): InterceptService {
  const { config, intel, store, bus, mutex } = ctx;
  /** Pending-quiz log ids whose grade missed the budget and is still running (prevents a second grade). */
  const lateGrading = new Set<UUID>();

  function setLevel(state: StudentNodeState, level: BloomLevel, treeId: UUID) {
    if (state.paused || state.current_blooms_level === level) return;
    state.current_blooms_level = level;
    state.updated_at = now();
    bus.publish(treeId, { type: 'student_state', data: state });
  }

  function applyGrade(pending: ChatLog, state: StudentNodeState, treeId: UUID, r: EvaluationResult) {
    const db = store.db;
    pending.verdict = r.verdict;
    pending.confidence = r.confidence;
    pending.rationale = r.rationale;
    if (r.verdict !== 'not_an_answer') pending.quiz_pending = false;
    setLevel(state, r.new_level, treeId);
    store.save();
    bus.publish(treeId, { type: 'activity', data: activityFromLog(db, pending, 'graded') });
  }

  async function run(req: InterceptRequest): Promise<InterceptResponse> {
    const t0 = Date.now();
    const db = store.db;
    const u = db.users.find((x) => x.id === req.student_id);
    if (!u) throw notFound('student');
    if (!u.active_tree_id) throw new HttpError(400, 'bad_request', 'student has no active tree');
    const treeId = u.active_tree_id;
    const nodes = db.nodes.filter((n) => n.tree_id === treeId);
    const nodeInTree = (id: UUID) => nodes.find((n) => n.id === id);
    const passthrough: InterceptResponse = {
      intercept_id: null, node_id: null, level: null, injected_prompt: req.raw_prompt, quiz_attached: false, graded: null,
    };

    // Step 1: pending quiz (same conversation, or latest within the window when there's no conversation id).
    const pending = [...db.logs].reverse().find(
      (l) =>
        l.student_id === u.id &&
        l.quiz_pending &&
        nodeInTree(l.node_id) &&
        (req.conversation_id
          ? l.conversation_id === req.conversation_id
          : Date.now() - Date.parse(l.created_at) < QUIZ_WINDOW_MS),
    );
    const pendingNode = pending ? nodeInTree(pending.node_id) : undefined;
    const pendingState = pending
      ? db.states.find((s) => s.student_id === u.id && s.node_id === pending.node_id)
      : undefined;

    // Step 2: classification and grading in parallel, inside the budget.
    const cls = pending ? null : timed(intel.classifyTopic(req.raw_prompt, nodes));
    const canGrade = !!(pending && pendingNode && pendingState && !pendingState.paused && !lateGrading.has(pending.id));
    const grade = canGrade
      ? timed(
          intel.evaluateExchange({
            node: pendingNode!,
            level: pendingState!.current_blooms_level,
            quiz_text: pending!.llm_response ?? req.previous_assistant_text ?? null,
            student_message: req.raw_prompt,
            demoMode: config.demo,
          }),
        )
      : null;

    const [clsRes, gradeRes] = await Promise.all([
      cls ? race(cls.p, config.interceptBudgetMs) : Promise.resolve(null),
      grade ? race(grade.p, config.interceptBudgetMs) : Promise.resolve(null),
    ]);

    // A demo reset while we were awaiting swaps the store's rows: our captured log/state would be orphans.
    const stale = () =>
      store.db !== db ||
      (!!pending && !db.logs.includes(pending)) ||
      (!!pendingState && !db.states.includes(pendingState));
    if (stale()) return passthrough;

    let graded: EvaluationResult | null = null;
    if (gradeRes?.done && gradeRes.value) {
      graded = gradeRes.value;
      applyGrade(pending!, pendingState!, treeId, graded);
    } else if (grade && gradeRes && !gradeRes.done) {
      // Late grade (rule 4.6): don't wait; apply it when it lands, even in DEMO_MODE.
      const logId = pending!.id;
      lateGrading.add(logId);
      void grade.p.then((r) =>
        mutex.run(u.id, async () => {
          lateGrading.delete(logId);
          if (!r) return; // grade failed: quiz stays pending, level unchanged
          if (stale()) return; // demo reset replaced the rows while we waited
          if (!pending!.quiz_pending || pendingState!.paused) return;
          applyGrade(pending!, pendingState!, treeId, r);
        }),
      );
    }

    // Step 3: resolve the node: pending quiz > classification > conversation stickiness > none.
    const classifiedId = clsRes?.done ? (clsRes.value ?? NO_MATCH).node_id : null;
    const stickyId = req.conversation_id
      ? [...db.logs].reverse().find((l) => l.student_id === u.id && l.conversation_id === req.conversation_id && nodeInTree(l.node_id))?.node_id ?? null
      : null;
    const nodeId = pending?.node_id ?? classifiedId ?? stickyId;
    const node = nodeId ? nodeInTree(nodeId) : undefined;
    if (!node) return passthrough;

    // Step 4: level, quiz, prompt.
    const state = db.states.find((s) => s.student_id === u.id && s.node_id === node.id);
    if (!state) throw notFound('student_state');
    const level: BloomLevel = state.paused ? 4 : state.current_blooms_level;
    const quizStillOpen = db.logs.some((l) => l.student_id === u.id && l.node_id === node.id && l.quiz_pending);
    const includeQuiz = level < 4 && !quizStillOpen;
    const feedback = graded ? { verdict: graded.verdict } : null;
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
    store.save();
    bus.publish(treeId, { type: 'activity', data: activityFromLog(db, log, 'intercept') });

    const fmt = (m: number | null | undefined) => (m == null ? '-' : `${m}ms`);
    console.log(
      `[intercept] student=${u.name} node="${node.concept_name}" level=L${level} classify=${cls ? fmt(cls.ms()) : '-'} grade=${grade ? fmt(grade.ms()) : '-'} verdict=${graded?.verdict ?? (grade ? 'late' : '-')} total=${Date.now() - t0}ms`,
    );

    return {
      intercept_id: log.id,
      node_id: node.id,
      level,
      injected_prompt: injected,
      quiz_attached: includeQuiz,
      graded: graded ? { verdict: graded.verdict, confidence: graded.confidence, new_level: graded.new_level } : null,
    };
  }

  return (req) => mutex.run(req.student_id, () => run(req));
}
