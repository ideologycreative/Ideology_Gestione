import Link from 'next/link';
import { initials, safeUrl, onColor } from '@/lib/utils';
import type { Progress } from '@/lib/client-progress';
import type { Database } from '@/lib/supabase/types';

type Client = Pick<Database['public']['Tables']['clients']['Row'], 'id' | 'name' | 'color' | 'logo_url'>;

/** Ported from legacy/src/app/sections.js's clientTile() — same anatomy, now a real link instead of a button+router.go. */
export function ClientTile({
  client,
  accounts,
  progress,
}: {
  client: Client;
  accounts: string[];
  progress?: Progress;
}) {
  const logo = safeUrl(client.logo_url);
  const p = progress ?? { done: 0, total: 0, pending: 0, pct: 0 };

  return (
    <Link href={`/clients/${client.id}`} className="tile" title={client.name}>
      <span className="tile-bar" style={{ background: client.color || 'var(--brand)' }} />
      <div className="tile-hd">
        {logo ? (
          <img className="tile-logo" src={logo} alt="" />
        ) : (
          <span
            className="tile-logo tile-logo--txt"
            style={{ background: client.color || 'var(--brand)', color: onColor(client.color) }}
          >
            {initials(client.name)}
          </span>
        )}
        <div className="tile-id">
          <span className="tile-name">{client.name}</span>
          <span className="tile-accs">{accounts.join(' · ') || 'Nessun account'}</span>
        </div>
      </div>
      <div className="tile-ft">
        <span className="tile-meter">
          <i style={{ width: `${Math.round(p.pct * 100)}%`, background: client.color || 'var(--brand)' }} />
        </span>
        <span className="tile-count">{p.total ? `${p.done}/${p.total}` : '—'}</span>
      </div>
      {p.pending > 0 && <span className="tile-flag">[??] {p.pending}</span>}
    </Link>
  );
}
