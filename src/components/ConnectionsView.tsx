'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { connectionStatus, connectionDaysLeft, type ConnectionStatus } from '@/lib/meta-status';
import { connectMetaMock, reconnectMetaMock, removeConnection } from '@/app/(app)/connections/actions';
import type { Database } from '@/lib/supabase/types';

type ConnectionRow = Database['public']['Tables']['meta_connections']['Row'] & {
  pages: Database['public']['Tables']['meta_pages']['Row'][];
};

function fmtDay(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function StatusPill({ status, daysLeft }: { status: ConnectionStatus; daysLeft: number | null }) {
  const label = status === 'expired' ? 'Scaduta' : status === 'expiring' ? `Scade fra ${daysLeft}g` : 'Attiva';
  return (
    <span className="conn-pill" data-s={status}>
      {label}
    </span>
  );
}

export function ConnectionsView({
  connections,
  brokenIssues,
  boundCounts,
  boundPageOwners,
}: {
  connections: ConnectionRow[];
  brokenIssues: { clientId: string; clientName: string; account: { platform: string }; issue: string }[];
  boundCounts: Record<string, number>;
  boundPageOwners: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <div className="page">
      <div className="page-hd">
        <div>
          <h1 className="page-title">Connessioni</h1>
          <p className="page-sub">Account Meta collegati. Le pagine si assegnano poi a ogni cliente.</p>
        </div>
        <div style={{ flex: 1 }} />
        {connections.length > 0 && (
          <button
            className="btn btn--primary"
            onClick={async () => {
              await connectMetaMock();
              router.refresh();
            }}
          >
            <Icon name="plus" size={13} />
            Collega account
          </button>
        )}
      </div>

      <div className="conn-note">
        <b>Modalità dimostrativa</b>
        <span>
          La connessione reale a Meta richiede il backend: il collegamento OAuth e i token devono stare sul server, mai nel
          browser. Qui l&apos;interfaccia funziona su dati simulati.
        </span>
      </div>

      {brokenIssues.length > 0 && (
        <div className="conn-warn">
          <b>
            [!!] {brokenIssues.length} {brokenIssues.length === 1 ? 'collegamento da sistemare' : 'collegamenti da sistemare'}
          </b>
          {brokenIssues.map((b, i) => (
            <Link key={i} href={`/clients/${b.clientId}`} className="conn-warn-row">
              <span className="conn-warn-client">
                {b.clientName} · {b.account.platform}
              </span>
              <span className="conn-warn-msg">{b.issue}</span>
            </Link>
          ))}
        </div>
      )}

      {connections.length === 0 ? (
        <div className="empty">
          <p>Nessun account Meta collegato.</p>
          <p className="note-line">
            Collegando il tuo account Meta, il tool vede le pagine Facebook che gestisci e gli account Instagram associati.
            Ogni cliente viene poi assegnato a una pagina specifica dalla sua scheda.
          </p>
          <button
            className="btn btn--primary"
            onClick={async () => {
              await connectMetaMock();
              router.refresh();
            }}
          >
            <Icon name="plus" size={13} />
            Collega account Meta
          </button>
        </div>
      ) : (
        connections.map((conn) => {
          const status = connectionStatus(conn);
          const days = connectionDaysLeft(conn);
          const bound = boundCounts[conn.id] ?? 0;

          return (
            <section className="card-panel card-panel--span conn-card" key={conn.id}>
              <div className="conn-hd">
                <span className="conn-mark" aria-hidden="true">
                  f
                </span>
                <div className="conn-id">
                  <span className="conn-name">{conn.account_name}</span>
                  <span className="conn-biz">{conn.business_name || 'Account personale'}</span>
                </div>
                <div style={{ flex: 1 }} />
                <StatusPill status={status} daysLeft={days} />
              </div>

              <p className="panel-sub">
                {conn.pages.length} {conn.pages.length === 1 ? 'pagina disponibile' : 'pagine disponibili'} · {bound} assegnate a
                clienti{conn.expires_at ? ` · token valido fino al ${fmtDay(conn.expires_at)}` : ''}
              </p>

              {status === 'expired' && <div className="conn-expired">Connessione scaduta: nessun contenuto verrà pubblicato finché non riconnetti.</div>}

              <div className="conn-pages">
                {conn.pages.map((p) => {
                  const taken = boundPageOwners[`${conn.id}|${p.page_id}`];
                  return (
                    <div className="conn-page" key={p.page_id}>
                      <div className="conn-page-id">
                        <span className="conn-page-name">{p.name}</span>
                        <span className="conn-page-cat">{p.category || ''}</span>
                      </div>
                      <div className="conn-page-tags">
                        <span className="conn-tag">FB</span>
                        {p.ig_user_id && (
                          <span
                            className={'conn-tag' + (p.ig_account_type === 'PERSONAL' ? ' conn-tag--bad' : ' conn-tag--ig')}
                            title={p.ig_account_type === 'PERSONAL' ? 'Account personale: non pubblicabile via API' : `Instagram ${(p.ig_account_type || '').toLowerCase()}`}
                          >
                            IG
                          </span>
                        )}
                      </div>
                      <span className={'conn-page-to' + (taken ? '' : ' is-free')}>{taken || 'non assegnata'}</span>
                    </div>
                  );
                })}
              </div>

              <div className="f-row" style={{ marginTop: 14 }}>
                <button
                  className={status === 'active' ? 'btn' : 'btn btn--primary'}
                  onClick={async () => {
                    await reconnectMetaMock(conn.id);
                    router.refresh();
                  }}
                >
                  <Icon name="link" size={13} />
                  Riconnetti
                </button>
                <button
                  className="btn btn--danger"
                  onClick={async () => {
                    if (!confirm("Rimuovere questa connessione? I clienti collegati alle sue pagine smetteranno di pubblicare finché non ne colleghi un'altra.")) return;
                    await removeConnection(conn.id);
                    router.refresh();
                  }}
                >
                  <Icon name="trash" size={13} />
                  Rimuovi
                </button>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
