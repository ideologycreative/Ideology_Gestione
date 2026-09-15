import type { Database } from '@/lib/supabase/types';

type ConnectionRow = Database['public']['Tables']['meta_connections']['Row'];

export type ConnectionStatus = 'active' | 'expiring' | 'expired';

/** No server-only imports on purpose — used from client components too (e.g. ConnectionsView). */
export function connectionStatus(conn: Pick<ConnectionRow, 'expires_at'>): ConnectionStatus {
  if (!conn.expires_at) return 'active';
  const days = Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

export function connectionDaysLeft(conn: Pick<ConnectionRow, 'expires_at'>): number | null {
  if (!conn.expires_at) return null;
  return Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86400000);
}
