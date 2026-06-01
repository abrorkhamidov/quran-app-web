import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useSettings } from '../settings/useSettings';

export function ProtectedRoute({ children, requireOnboarded = true }: { children: ReactNode; requireOnboarded?: boolean }) {
  const { user, loading } = useAuth();
  const { onboarded, settingsLoaded } = useSettings();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireOnboarded) {
    if (!settingsLoaded) return <div className="p-8 text-muted">Loading…</div>;
    if (!onboarded) return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
