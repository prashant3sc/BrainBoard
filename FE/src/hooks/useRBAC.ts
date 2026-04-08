import useAuthStore from '@/store/useAuthStore';
import { PERMISSIONS } from '@/lib/constants';
import type { Role } from '@/types';

export function useRBAC() {
  const role = useAuthStore((s) => s.user?.role ?? null) as Role | null;

  const can = (permission: string): boolean =>
    role !== null && (PERMISSIONS[permission]?.includes(role) ?? false);

  const isAdmin = (): boolean => role === 'admin';
  const isPM = (): boolean => role === 'pm';

  return { role, can, isAdmin, isPM };
}
