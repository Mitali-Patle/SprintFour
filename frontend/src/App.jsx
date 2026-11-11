import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Dashboard   from './pages/Dashboard';
import ReviewPanel from './pages/ReviewPanel';

// Keyed by id so moving to the next document remounts with clean state.
function ReviewRoute() {
  const { id } = useParams();
  return <ReviewPanel key={id} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/review/:id" element={<ReviewRoute />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
