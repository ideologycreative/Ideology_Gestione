import Link from 'next/link';
import { PageFrame } from '@/components/PageFrame';
import { getStudioStats } from '@/lib/stats';
import { thisMonthLabel } from '@/lib/dates';

export default async function StudioHomePage() {
  const t = await getStudioStats();

  const stats = [
    { n: t.clients, l: 'Clienti', go: '/clients' },
    { n: t.accounts, l: 'Account social', go: '/clients' },
    { n: t.posts, l: 'Contenuti', go: '/content' },
    { n: t.done, l: 'Approvati', go: '/content', cls: 'stat--brand' },
    { n: t.sponsored, l: 'Sponsorizzati', go: '/calendar', cls: 'stat--spon' },
  ];

  return (
    <PageFrame>
      <div className="page page--home">
        <div className="home-hero">
          <div className="home-mark" aria-hidden="true">!d</div>
          <h1 className="home-word">Ideology</h1>
          <p className="home-sub">Creative Studio · Ragusa · Milano</p>
        </div>

        <div className="home-month">{thisMonthLabel()}</div>

        <div className="home-stats">
          {stats.map((s) => (
            <Link key={s.l} href={s.go} className={'stat' + (s.cls ? ' ' + s.cls : '')}>
              <span className="stat-n">{s.n}</span>
              <span className="stat-l">{s.l}</span>
            </Link>
          ))}
        </div>

        {(t.pending > 0 || t.revision > 0) && (
          <div className="home-alerts">
            {t.pending > 0 && (
              <Link href="/content" className="alert">
                <b>[??]</b>
                {t.pending === 1 ? ' 1 contenuto in attesa del cliente' : ` ${t.pending} contenuti in attesa del cliente`}
              </Link>
            )}
            {t.revision > 0 && (
              <Link href="/content" className="alert alert--warn">
                <b>[!!]</b>
                {t.revision === 1 ? ' 1 modifica richiesta' : ` ${t.revision} modifiche richieste`}
              </Link>
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
