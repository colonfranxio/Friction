import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SEED_IDS } from '@friction/shared';
import { TreePage } from './pages/TreePage';
export function App() {
  return <BrowserRouter><Routes><Route path="/" element={<Navigate to={`/educator/${SEED_IDS.tree}`} replace />} /><Route path="/educator/:treeId" element={<TreePage key="educator" />} /><Route path="/student/:studentId" element={<TreePage key="student" studentView />} /><Route path="/sandbox" element={<div className="center-state"><h1>Sandbox</h1><p>Streaming chat arrives at CP2.</p><a href="/">Return to your skill tree</a></div>} /><Route path="*" element={<div className="center-state"><h1>This path is still unexplored.</h1><a href="/">Back to your learning tree</a></div>} /></Routes></BrowserRouter>;
}
