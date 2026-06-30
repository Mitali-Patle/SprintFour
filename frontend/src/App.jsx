import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import ReviewPanel from './pages/ReviewPanel';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/review/:id" element={<ReviewPanel />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
