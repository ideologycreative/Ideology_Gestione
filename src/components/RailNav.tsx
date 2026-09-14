'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';

const MENU = [
  { id: 'home', path: '/', label: 'Home', ic: 'home' },
  { id: 'clients', path: '/clients', label: 'Clienti', ic: 'users' },
  { id: 'content', path: '/content', label: 'Contenuti', ic: 'layers' },
  { id: 'ugc', path: '/ugc', label: 'UGC', ic: 'clapper' },
  { id: 'calendar', path: '/calendar', label: 'Calendario', ic: 'calendar' },
  { id: 'preview', path: '/preview', label: 'Anteprima', ic: 'eye' },
  // Connessioni is deliberately not in this list — the rail footer link
  // below covers it, with the connected account's status. Two links to
  // the same page in one rail is noise.
  { id: 'settings', path: '/settings', label: 'Impostazioni', ic: 'cog' },
] as const;

export type MetaRailStatus = {
  label: string;
  state: 'active' | 'expiring' | 'expired' | 'broken' | 'none';
  title: string;
};

export function RailNav({ meta }: { meta: MetaRailStatus }) {
  const pathname = usePathname();

  return (
    <nav id="rail" aria-label="Sezioni">
      <Link href="/" className="rail-hd" title="Home">
        <span className="mark" aria-hidden="true">Id</span>
        <span className="wordmark">Ideology</span>
      </Link>

      <div className="menu" role="navigation" aria-label="Sezioni">
        {MENU.map((m) => {
          const on = m.path === '/' ? pathname === '/' : pathname.startsWith(m.path);
          return (
            <Link
              key={m.id}
              href={m.path}
              className={'menu-item' + (on ? ' is-on' : '')}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={m.ic} size={15} />
              <span>{m.label}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div className="rail-ft">
        <Link
          href="/connections"
          className="rail-link rail-conn"
          title={meta.title}
          data-s={meta.state === 'none' ? undefined : meta.state}
        >
          <Icon name="link" size={12} />
          <span className="rail-conn-label">{meta.label}</span>
          {meta.state !== 'active' && meta.state !== 'none' && <i className="rail-conn-dot" />}
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
