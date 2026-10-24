import { ICON_KEYWORDS, wouldCreateCycle, type BloomLevel, type Edge, type ParsedTree } from '@friction/shared';

const ICONS = new Set<string>(ICON_KEYWORDS);
const MAX_NODES = 15;

/** Post-parse fixes so the tree always satisfies the contract (contracts §8). */
export function validateTree(tree: ParsedTree): ParsedTree {
  const pillars = [...new Set(tree.pillars.map((p) => p.trim()).filter(Boolean))];
  if (!pillars.length) throw new Error('parseSyllabus: no pillars');
  const pillarOf = (p: string) => pillars.find((x) => x.toLowerCase() === p.trim().toLowerCase()) ?? pillars[0];

  // Unique keys: later duplicates get a suffix.
  const seen = new Set<string>();
  const nodes = tree.nodes.slice(0, MAX_NODES).map((n, i) => {
    let key = n.key.trim() || `n${i + 1}`;
    while (seen.has(key)) key = `${key}_${i + 1}`;
    seen.add(key);
    return {
      ...n,
      key,
      pillar: pillarOf(n.pillar),
      required_blooms_level: Math.min(4, Math.max(1, Math.round(n.required_blooms_level))) as BloomLevel,
      size: n.size === 'major' ? ('major' as const) : ('minor' as const),
      icon: ICONS.has(n.icon) ? n.icon : 'circle',
      keywords: [...new Set(n.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))],
    };
  });
  if (!nodes.length) throw new Error('parseSyllabus: no nodes');

  // Valid deps only, adding edges in order and dropping any that would close a cycle.
  const edges: Edge[] = [];
  for (const n of nodes) {
    const deps: string[] = [];
    for (const d of new Set(n.depends_on)) {
      if (!seen.has(d) || wouldCreateCycle(edges, d, n.key)) continue;
      edges.push({ tree_id: '', parent_node_id: d, child_node_id: n.key });
      deps.push(d);
    }
    n.depends_on = deps;
  }
  return { title: tree.title.trim() || 'Course', pillars, nodes };
}
