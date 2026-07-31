import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return null; // or loading spinner, handled globally
  }

  return isAdmin ? (children ? children : <Outlet />) : <Navigate to="/home" replace />;
}
