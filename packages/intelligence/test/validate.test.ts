import { fakeParse, type ParsedNode, type ParsedTree } from '@friction/shared';
import { describe, expect, it } from 'vitest';
import { validateTree } from '../src/validate';

const node = (key: string, over: Partial<ParsedNode> = {}): ParsedNode => ({
  key,
  pillar: 'A',
  concept_name: key,
  mastery_criteria: 'm',
  required_blooms_level: 3,
  size: 'minor',
  icon: 'code',
  keywords: ['x'],
  depends_on: [],
  ...over,
});
const tree = (nodes: ParsedNode[]): ParsedTree => ({ title: 'T', pillars: ['A', 'B', 'C'], nodes });

describe('validateTree', () => {
  it('leaves the seed-shaped tree unchanged', () => {
    const seed = fakeParse({ kind: 'text', text: '' });
    expect(validateTree(structuredClone(seed))).toEqual(seed);
  });

  it('dedupes keys, drops unknown and self deps', () => {
    const out = validateTree(tree([node('n1'), node('n1'), node('n2', { depends_on: ['n1', 'n1', 'ghost', 'n2'] })]));
    expect(out.nodes.map((n) => n.key)).toEqual(['n1', 'n1_2', 'n2']);
    expect(out.nodes[2].depends_on).toEqual(['n1']);
  });

  it('breaks cycles', () => {
    const out = validateTree(tree([node('a', { depends_on: ['c'] }), node('b', { depends_on: ['a'] }), node('c', { depends_on: ['b'] })]));
    const deps = out.nodes.flatMap((n) => n.depends_on.map((d) => `${d}->${n.key}`));
    expect(deps).toEqual(['c->a', 'a->b']); // c depends on b would close the loop
  });

  it('clamps levels, forces icons and sizes, lowercases keywords, fixes pillars', () => {
    const [n] = validateTree(
      tree([node('n1', { required_blooms_level: 9 as any, icon: 'rocket', size: 'huge' as any, keywords: [' useEffect ', 'useeffect', ''], pillar: 'b' })]),
    ).nodes;
    expect(n).toMatchObject({ required_blooms_level: 4, icon: 'circle', size: 'minor', keywords: ['useeffect'], pillar: 'B' });
    expect(validateTree(tree([node('n1', { pillar: 'Nope' })])).nodes[0].pillar).toBe('A');
  });

  it('caps at 15 nodes and drops deps on cut nodes', () => {
    const many = Array.from({ length: 17 }, (_, i) => node(`n${i}`));
    many[0].depends_on = ['n16'];
    const out = validateTree(tree(many));
    expect(out.nodes).toHaveLength(15);
    expect(out.nodes[0].depends_on).toEqual([]);
  });

  it('throws on an empty tree', () => {
    expect(() => validateTree(tree([]))).toThrow(/no nodes/);
    expect(() => validateTree({ title: 'T', pillars: [], nodes: [node('n1')] })).toThrow(/no pillars/);
  });
});
