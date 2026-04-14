import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import COCList from './pages/COCList';
import COCDetail from './pages/COCDetail';
import Upload from './pages/Upload';
import AdminUsers from './pages/AdminUsers';
import Favourites from './pages/Favourites';
import Export from './pages/Export';
import './index.css';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/coc" element={<ProtectedRoute><COCList /></ProtectedRoute>} />
      <Route path="/coc/:id" element={<ProtectedRoute><COCDetail /></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute adminOnly><Upload /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/favourites" element={<ProtectedRoute><Favourites /></ProtectedRoute>} />
      <Route path="/export" element={<ProtectedRoute adminOnly><Export /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
