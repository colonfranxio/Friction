import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { SEED_IDS } from '@friction/shared';
import { lazy, Suspense } from 'react';
const TreePage = lazy(() => import('./pages/TreePage').then((module) => ({ default: module.TreePage })));
const SandboxPage = lazy(() => import('./pages/SandboxPage').then((module) => ({ default: module.SandboxPage })));
const EmbedPage = lazy(() => import('./pages/EmbedPage').then((module) => ({ default: module.EmbedPage })));
const StudentRoute = () => useSearchParams()[0].get('embed') === '1' ? <EmbedPage /> : <TreePage key="student" studentView />;
export function App() {
  return <BrowserRouter><Suspense fallback={<div className="center-state" role="status"><span className="loading-orbit" /><p>Opening your learning space…</p></div>}><Routes><Route path="/" element={<Navigate to={`/educator/${SEED_IDS.tree}`} replace />} /><Route path="/educator/:treeId" element={<TreePage key="educator" />} /><Route path="/student/:studentId" element={<StudentRoute />} /><Route path="/sandbox" element={<SandboxPage />} /><Route path="*" element={<div className="center-state"><h1>This path is still unexplored.</h1><a href="/">Back to your learning tree</a></div>} /></Routes></Suspense></BrowserRouter>;
}
