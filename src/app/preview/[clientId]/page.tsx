import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { monthBounds } from '@/lib/dates';
import { accentVars, onColor, initials, safeUrl } from '@/lib/utils';
import { Thumb } from '@/components/content/Thumb';
import { statusOf, ratioFor, fmtDay } from '@/lib/platforms';
import '@/styles/portal.css';

/**
 * Deliberately NOT inside (app) — no rail, no studio nav, no PageFrame.
 * This is "what the client sees", so it's styled off portal.css (the
 * client's own accent, the same masthead language) instead of the studio's
 * own neutral admin chrome, which is what made the old version under
 * (app)/preview/ read as "an admin screen with a panel swapped out"
 * instead of an actual preview. Read-only on purpose: a studio user
 * previewing isn't the client and shouldn't be able to approve as one.
 */
export default async function StudioPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ account?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.kind !== 'studio') redirect('/');

  const { clientId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: client }, { data: accounts }, { data: logoSetting }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('accounts').select('*').eq('client_id', clientId).order('created_at'),
    supabase.from('settings').select('value').eq('key', 'studioLogo').maybeSingle(),
  ]);
  if (!client) notFound();

  const accs = accounts ?? [];
  const account = accs.find((a) => a.id === sp.account) ?? accs[0] ?? null;

  const { start, end } = monthBounds();
  const { data: items } = account
    ? await supabase
        .from('content_items')
        .select('*')
        .eq('account_id', account.id)
        .eq('kind', 'feed')
        .neq('appr_stato', 'bozza')
        .gte('date', start)
        .lt('date', end)
        .order('date')
    : { data: [] };

  const studioLogo = (logoSetting?.value as { url?: string } | undefined)?.url ?? '';
  const clientColor = client.color || '#5B50E6';
  const clientLogo = safeUrl(client.logo_url);

  return (
    <div data-theme={client.theme === 'light' ? 'light' : 'dark'} style={accentVars(clientColor) as React.CSSProperties}>
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
            {clientLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cv-logo" src={clientLogo} alt="" />
            ) : (
              <span className="cv-logo cv-logo--txt" style={{ background: clientColor, color: onColor(clientColor) }}>
                {initials(client.name)}
              </span>
            )}
            <span className="cv-client">{client.name}</span>
          </div>
        </div>
      </div>

      <div className="portal-wrap">
        <Link href="/preview" className="preview-back">
          ← Tutti i clienti
        </Link>

        <div className="preview-banner">
          Anteprima studio — sola lettura, le bozze non sono incluse. Questo non è il portale del cliente.
        </div>

        {accs.length > 1 && (
          <div className="preview-accounts">
            {accs.map((a) => (
              <Link
                key={a.id}
                href={`/preview/${client.id}?account=${a.id}`}
                className={'preview-acc' + (account?.id === a.id ? ' is-on' : '')}
              >
                {a.platform}
              </Link>
            ))}
          </div>
        )}

        {!account ? (
          <div className="cv-empty">Nessun account social collegato.</div>
        ) : !items || items.length === 0 ? (
          <div className="cv-empty">Nessun contenuto visibile al cliente questo mese.</div>
        ) : (
          <div className="cv-grid" style={{ '--cols': 3 } as React.CSSProperties}>
            {items.map((item) => {
              const st = statusOf(item.appr_stato);
              return (
                <div className={'cv-post' + (item.sponsored ? ' is-spon' : '')} key={item.id}>
                  <div className="cv-media">
                    <Thumb item={item} ratio={ratioFor(item, account, 'grid')} />
                    {item.date && <span className="cv-mark-bl">{fmtDay(item.date)}</span>}
                  </div>
                  <div className="cv-meta">
                    {item.copy && <div className="cv-copy">{item.copy}</div>}
                    <span className="preview-status" data-s={item.appr_stato}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
