import { Navigate } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import { useRBAC } from '@/hooks/useRBAC';

interface Props {
  children: React.ReactNode;
  permission?: string;
}

export default function ProtectedRoute({ children, permission }: Props) {
  const isLoggedIn = useAuthStore((s) => s.user !== null);
  const { can } = useRBAC();

  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
