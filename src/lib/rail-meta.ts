import { createClient } from '@/lib/supabase/server';
import type { MetaRailStatus } from '@/components/RailNav';

/**
 * Ported from legacy/src/app/shell.js's metaLink() — same worst-status
 * logic (expired > expiring > broken > active), same label rule (one
 * connection shows its account name, more than one shows a count).
 */
export async function getMetaRailStatus(): Promise<MetaRailStatus> {
  const supabase = await createClient();

  const { data: connections } = await supabase
    .from('meta_connections')
    .select('id, account_name, expires_at');

  if (!connections || connections.length === 0) {
    return { label: 'Collega Meta', state: 'none', title: 'Collega un account Meta' };
  }

  const now = Date.now();
  let worst: MetaRailStatus['state'] = 'active';
  for (const c of connections) {
    if (!c.expires_at) continue;
    const daysLeft = (new Date(c.expires_at).getTime() - now) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 0) worst = 'expired';
    else if (daysLeft <= 7 && worst !== 'expired') worst = 'expiring';
  }

  // A "broken" binding: an account still carries a page_id but its
  // connection was removed (meta_connection_id is null, ON DELETE SET NULL
  // fired when the connection was deleted) — the studio side flags this
  // loudly rather than silently leaving a dead binding.
  const { count: brokenCount } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .not('meta_page_id', 'is', null)
    .is('meta_connection_id', null);

  if (brokenCount && worst === 'active') worst = 'broken';

  const label = connections.length === 1 ? connections[0].account_name || 'Account Meta' : `${connections.length} account Meta`;

  const title =
    worst === 'expired' ? 'Connessione Meta scaduta — riconnetti'
    : worst === 'expiring' ? 'Il token Meta sta per scadere'
    : worst === 'broken' ? `${brokenCount} collegamenti da sistemare`
    : 'Account Meta collegato';

  return { label, state: worst, title };
}
