import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signOutClient } from '@/lib/sign-out';
import { createClient } from '@/lib/supabase/server';
import { accentVars, onColor } from '@/lib/utils';
import '@/styles/portal.css';

/** Ported from legacy client portal's masthead() — Ideology first (the studio's own logo, uploaded in Impostazioni), the client's colour/logo second, whose page this is is unambiguous from the first glance. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect('/portal/login');
  if (profile.kind !== 'client') redirect('/');

  const supabase = await createClient();
  const [{ data: client }, { data: logoSetting }] = await Promise.all([
    supabase.from('clients').select('name, color, theme, logo_url').single(),
    supabase.from('settings').select('value').eq('key', 'studioLogo').maybeSingle(),
  ]);

  const studioLogo = (logoSetting?.value as { url?: string } | undefined)?.url ?? '';
  const clientName = client?.name ?? '';
  const clientColor = client?.color ?? '#5B50E6';
  const initials = clientName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div data-theme={client?.theme === 'light' ? 'light' : 'dark'} style={accentVars(clientColor) as React.CSSProperties}>
      <div className="cv-top">
        <div className="cv-top-in">
          <div className="cv-studio">
            {studioLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={studioLogo} alt="Ideology" />
            ) : (
              <>
                <span className="cv-mark" aria-hidden="true">!d</span>
                <span className="cv-by">Ideology</span>
              </>
            )}
          </div>
          <div className="cv-spacer" />
          <div className="cv-client-id">
            {client?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cv-logo" src={client.logo_url} alt="" />
            ) : (
              <span className="cv-logo cv-logo--txt" style={{ background: clientColor, color: onColor(clientColor) }}>
                {initials || '?'}
              </span>
            )}
            <span className="cv-client">{clientName}</span>
            <form action={signOutClient}>
              <button className="cv-signout" type="submit">Esci</button>
            </form>
          </div>
        </div>
      </div>
      <div className="portal-wrap">{children}</div>
    </div>
  );
}
