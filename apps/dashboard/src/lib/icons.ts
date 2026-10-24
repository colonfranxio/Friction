import { ArrowDown, BookOpen, Box, Cable, ChartNoAxesColumn, Circle, Code, Cpu, Database, Download, GitBranch, Globe, Grid2X2, Layers, List, Lock, Puzzle, RefreshCw, Search, Server, Share2, Shield, Sigma, Terminal, Zap, type LucideIcon } from 'lucide-react';
import { ICON_KEYWORDS } from '@friction/shared';
const icons: Record<(typeof ICON_KEYWORDS)[number], LucideIcon> = {
  code: Code, box: Box, 'arrow-down': ArrowDown, refresh: RefreshCw, download: Download,
  hook: Cable, share: Share2, zap: Zap, database: Database, grid: Grid2X2, layers: Layers,
  lock: Lock, globe: Globe, cpu: Cpu, terminal: Terminal, book: BookOpen, puzzle: Puzzle,
  'git-branch': GitBranch, server: Server, shield: Shield, chart: ChartNoAxesColumn,
  function: Sigma, list: List, search: Search, circle: Circle,
};
export const conceptIcon = (keyword: string): LucideIcon => icons[keyword as keyof typeof icons] ?? Circle;
