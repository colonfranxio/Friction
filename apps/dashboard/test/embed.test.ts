import { describe, expect, it } from 'vitest';
import { buildSeed, computeDepths, computeNodeStatuses, type TreeBundle } from '@friction/shared';
import { nextUp, tryAsking } from '../src/pages/EmbedPage';

const seed = buildSeed();
const bundle: TreeBundle = { tree: seed.trees[0], pillars: seed.pillars, nodes: seed.nodes, edges: seed.edges };

describe('embed Next up', () => {
  it('lists only active nodes, shallowest first, at most 3, skipping Now learning', () => {
    const statuses = computeNodeStatuses(bundle.nodes, bundle.edges, {});
    const active = bundle.nodes.filter((n) => statuses[n.id] === 'active');
    const list = nextUp(bundle, statuses, active[0].id);
    expect(list.length).toBeLessThanOrEqual(3);
    expect(list.every((n) => statuses[n.id] === 'active' && n.id !== active[0].id)).toBe(true);
    expect(nextUp(bundle, statuses, active[0].id)).toEqual(list);
  });
  it('orders shallowest first, then by name', () => {
    const depths = computeDepths(bundle.nodes, bundle.edges);
    const allActive = Object.fromEntries(bundle.nodes.map((n) => [n.id, 'active' as const]));
    const list = nextUp(bundle, allActive, undefined, bundle.nodes.length);
    expect(list).toHaveLength(bundle.nodes.length);
    for (let i = 1; i < list.length; i++) {
      const [a, b] = [list[i - 1], list[i]];
      expect(depths[a.id] < depths[b.id] || (depths[a.id] === depths[b.id] && a.concept_name.localeCompare(b.concept_name) <= 0)).toBe(true);
    }
  });
  it('is empty when nothing is active', () => {
    const allLocked = Object.fromEntries(bundle.nodes.map((n) => [n.id, 'locked' as const]));
    expect(nextUp(bundle, allLocked)).toEqual([]);
  });
  it('builds a starter from the concept name', () => {
    expect(tryAsking('React useEffect')).toContain('React useEffect');
  });
});
