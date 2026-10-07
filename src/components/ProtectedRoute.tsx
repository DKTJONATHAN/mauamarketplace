import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoToLogin } from '../hooks';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const goToLogin = useGoToLogin();

  useEffect(() => {
    if (!loading && !user) goToLogin();
  }, [loading, user, goToLogin]);

  if (loading) return <div className="wrap page" aria-busy="true">Loading...</div>;
  if (!user) return null;
  return <Outlet />;
}
