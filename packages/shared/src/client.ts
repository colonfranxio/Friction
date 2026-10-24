/**
 * Typed fetch client for the API. Used by the dashboard, the extension's service worker,
 * and scripts/smoke.ts. Throws ApiError on non-2xx.
 */
import type {
  AcceptedResponse,
  ApiErrorBody,
  BypassRequest,
  BypassResponse,
  ChatRequest,
  CreateEdgeRequest,
  CreateNodeRequest,
  DemoResetRequest,
  ErrorCode,
  HealthResponse,
  HeartbeatRequest,
  InterceptRequest,
  InterceptResponse,
  ParseTreeRequest,
  ParseTreeResponse,
  RenamePillarRequest,
  ResponsesRequest,
  StudentStateResponse,
  TreeActivityResponse,
  TreeBundle,
  TreeStudentsResponse,
  UpdateNodeRequest,
} from './api';
import type { Edge, Pillar, SkillNode, UUID } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createFrictionClient(baseUrl: string, fetchImpl: FetchLike = (i, r) => fetch(i, r)) {
  const base = baseUrl.replace(/\/$/, '');

  async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetchImpl(base + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      const err = (json as ApiErrorBody | undefined)?.error;
      throw new ApiError(res.status, err?.code ?? 'internal', err?.message ?? res.statusText);
    }
    return json as T;
  }

  return {
    baseUrl: base,
    health: () => call<HealthResponse>('GET', '/health'),
    parseTree: (b: ParseTreeRequest) => call<ParseTreeResponse>('POST', '/trees/parse', b),
    getTree: (treeId: UUID) => call<TreeBundle>('GET', `/trees/${treeId}`),
    createNode: (treeId: UUID, b: CreateNodeRequest) => call<SkillNode>('POST', `/trees/${treeId}/nodes`, b),
    updateNode: (nodeId: UUID, b: UpdateNodeRequest) => call<SkillNode>('PATCH', `/nodes/${nodeId}`, b),
    deleteNode: (nodeId: UUID) => call<void>('DELETE', `/nodes/${nodeId}`),
    createEdge: (b: CreateEdgeRequest) => call<Edge>('POST', '/edges', b),
    deleteEdge: (parentId: UUID, childId: UUID) => call<void>('DELETE', `/edges/${parentId}/${childId}`),
    renamePillar: (pillarId: UUID, b: RenamePillarRequest) => call<Pillar>('PATCH', `/pillars/${pillarId}`, b),
    treeStudents: (treeId: UUID) => call<TreeStudentsResponse>('GET', `/trees/${treeId}/students`),
    treeActivity: (treeId: UUID) => call<TreeActivityResponse>('GET', `/trees/${treeId}/activity`),
    getStudent: (studentId: UUID) => call<StudentStateResponse>('GET', `/students/${studentId}`),
    intercept: (b: InterceptRequest, signal?: AbortSignal) =>
      call<InterceptResponse>('POST', '/intercept', b, signal),
    responses: (b: ResponsesRequest) => call<AcceptedResponse>('POST', '/responses', b),
    bypass: (b: BypassRequest) => call<BypassResponse>('POST', '/bypass', b),
    heartbeat: (b: HeartbeatRequest) => call<void>('POST', '/heartbeat', b),
    demoReset: (b: DemoResetRequest) => call<AcceptedResponse>('POST', '/demo/reset', b),
    /** Raw streaming response (text/plain). Read CHAT_HEADERS for metadata. */
    chat: (b: ChatRequest, signal?: AbortSignal) =>
      fetchImpl(base + '/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(b),
        signal,
      }),
    /** Use with `new EventSource(url)`; listen per ServerEvent type. */
    eventsUrl: (treeId: UUID) => `${base}/events?tree_id=${encodeURIComponent(treeId)}`,
  };
}

export type FrictionClient = ReturnType<typeof createFrictionClient>;
