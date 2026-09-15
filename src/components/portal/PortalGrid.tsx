'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { platform, ratioFor, fmtDay } from '@/lib/platforms';
import { longDate } from '@/lib/dates';
import { monthLabel } from '@/lib/month-param';
import { safeUrl, safeVideoUrl, onColor, initials } from '@/lib/utils';
import { approveItem, requestRevision } from '@/app/portal/(protected)/actions';
import type { Database, Slide } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type PillarRow = Database['public']['Tables']['pillars']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];

const TOKEN = {
  approvato: '[OK] Approvato',
  pubblicato: '[>>] Pubblicato',
  revisione: '[!!] Modifica richiesta',
};

const IC = {
  heart: 'M12 21s-8-4.9-8-10.4A4.6 4.6 0 0112 7a4.6 4.6 0 018 3.6C20 16.1 12 21 12 21z',
  comment: 'M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 013 11.5a9 9 0 0118 0z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  save: 'M19 21l-7-5-7 5V4a1 1 0 011-1h12a1 1 0 011 1z',
};

function MiniIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * Ported 1:1 from legacy client portal's gridPanel()/postCard()/openPost()/
 * paintPost()/openRevision()/sendRevision() — grid of approvable posts, a
 * platform-accurate detail view (not a lightbox: Instagram desktop is
 * media-left/caption-rail, Facebook/others stack header→caption→media), and
 * the two writes (approve / request revision) that go through the
 * SECURITY DEFINER RPCs in src/app/portal/(protected)/actions.ts.
 */
export function PortalGrid({
  items,
  account,
  pillars,
  client,
  month,
}: {
  items: ItemRow[];
  account: AccountRow | null;
  pillars: PillarRow[];
  client: ClientRow;
  month: Date;
}) {
  const router = useRouter();
  const pillarName = (id: string | null) => pillars.find((p) => p.id === id)?.name ?? '';

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [revisionIndex, setRevisionIndex] = useState<number | null>(null);
  const [revisionText, setRevisionText] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
        setRevisionIndex(null);
      }
      if (lightboxIndex != null && pvItems.length > 1) {
        if (e.key === 'ArrowLeft') setSlideIdx((i) => (i - 1 + pvItems.length) % pvItems.length);
        if (e.key === 'ArrowRight') setSlideIdx((i) => (i + 1) % pvItems.length);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex]);

  const pf = platform(account?.platform);
  const pvItem = lightboxIndex != null ? items[lightboxIndex] : null;
  const pvItems: { url: string; videoUrl: string; copy: string }[] =
    pvItem && pvItem.type === 'carousel' && pvItem.slides.length
      ? pvItem.slides.map((s: Slide) => ({ url: s.url || s.externalUrl, videoUrl: s.videoUrl || '', copy: s.copy }))
      : pvItem
        ? [{ url: pvItem.url || pvItem.external_url, videoUrl: '', copy: '' }]
        : [];
  const cur = pvItems[slideIdx] ?? { url: '', videoUrl: '', copy: '' };

  async function doApprove(item: ItemRow) {
    setPending(item.id);
    try {
      await approveItem(item.id);
      setToast('Contenuto approvato');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function openRevisionModal(item: ItemRow) {
    setRevisionIndex(items.indexOf(item));
    setRevisionText(item.client_note || '');
  }

  async function sendRevision() {
    if (revisionIndex == null) return;
    const text = revisionText.trim();
    if (!text) {
      setToast('Scrivi cosa vorresti cambiare');
      return;
    }
    const item = items[revisionIndex];
    setPending(item.id);
    try {
      await requestRevision(item.id, text);
      setRevisionIndex(null);
      setToast('Richiesta inviata al team');
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  function openLightbox(index: number) {
    setSlideIdx(0);
    setLightboxIndex(index);
  }

  const handle = account?.handle || account?.name || client.name;

  return (
    <>
      <div className="cv-grid" style={{ '--cols': pf.cols } as React.CSSProperties}>
        {items.length === 0 && <div className="cv-empty">Nessun contenuto per {monthLabel(month)}</div>}
        {items.map((item, index) => {
          const stato = item.appr_stato;
          const isBusy = pending === item.id;
          return (
            <div className={'cv-post' + (item.sponsored ? ' is-spon' : '')} key={item.id}>
              <PostMedia item={item} account={account} onClick={() => openLightbox(index)} />

              <div className="cv-meta">
                {item.copy && <div className="cv-copy">{item.copy}</div>}
                {item.pillar_id && pillarName(item.pillar_id) && (
                  <div className="cv-pillar">
                    <i />
                    {pillarName(item.pillar_id)}
                  </div>
                )}
                {item.client_note && (
                  <div className="cv-note">
                    <b>La tua richiesta</b>
                    {item.client_note}
                  </div>
                )}
              </div>

              {stato === 'pubblicato' ? (
                <div className="cv-done">{TOKEN.pubblicato}</div>
              ) : stato === 'approvato' ? (
                <div className="cv-actions">
                  <button className="cv-btn" type="button" disabled={isBusy} onClick={() => openRevisionModal(item)}>
                    Richiedi una modifica
                  </button>
                  <div className="cv-done cv-done--inline">{TOKEN.approvato}</div>
                </div>
              ) : stato === 'revisione' ? (
                <div className="cv-pending">{TOKEN.revisione}</div>
              ) : (
                <div className="cv-actions">
                  <button className="cv-btn" type="button" disabled={isBusy} onClick={() => openRevisionModal(item)}>
                    Modifica
                  </button>
                  <button className="cv-btn primary" type="button" disabled={isBusy} onClick={() => void doApprove(item)}>
                    Approva
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={'pv' + (lightboxIndex != null ? ' open' : '')}>
        <button className="pv-close" aria-label="Chiudi" onClick={() => setLightboxIndex(null)}>
          ✕
        </button>
        {pvItems.length > 1 && (
          <>
            <button className="pv-nav prev" aria-label="Precedente" onClick={() => setSlideIdx((i) => (i - 1 + pvItems.length) % pvItems.length)}>
              ‹
            </button>
            <button className="pv-nav next" aria-label="Successivo" onClick={() => setSlideIdx((i) => (i + 1) % pvItems.length)}>
              ›
            </button>
          </>
        )}
        <div className="pv-shell">
          <span className="pv-plat">
            {pf.label} · anteprima {pf.layout === 'ig' ? 'desktop' : 'feed'}
          </span>
          {pvItem && (
            <PostDetail
              item={pvItem}
              cur={cur}
              pvItemsCount={pvItems.length}
              slideIdx={slideIdx}
              layout={pf.layout}
              account={account}
              client={client}
              handle={handle}
            />
          )}
        </div>
      </div>

      <div className={'cv-modal-bg' + (revisionIndex != null ? ' open' : '')} onClick={(e) => { if (e.target === e.currentTarget) setRevisionIndex(null); }}>
        <div className="cv-modal" role="dialog" aria-modal="true" aria-labelledby="cv-modal-title">
          <h2 id="cv-modal-title">Richiedi una modifica</h2>
          <p>Descrivi cosa vorresti cambiare. Il messaggio arriva direttamente al team che ha preparato il contenuto.</p>
          <textarea
            value={revisionText}
            onChange={(e) => setRevisionText(e.target.value)}
            placeholder="Es. Possiamo usare una foto diversa? Questa l'abbiamo già pubblicata a luglio."
            autoFocus
          />
          <div className="cv-modal-actions">
            <button className="cv-btn" type="button" onClick={() => setRevisionIndex(null)}>
              Annulla
            </button>
            <button className="cv-btn primary" type="button" onClick={() => void sendRevision()}>
              Invia richiesta
            </button>
          </div>
        </div>
      </div>

      <div className={'cv-toast' + (toast ? ' show' : '')} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

function PostMedia({ item, account, onClick }: { item: ItemRow; account: AccountRow | null; onClick: () => void }) {
  const [broken, setBroken] = useState(false);
  const url = safeUrl(item.url || item.external_url);

  return (
    <div className="cv-media" style={{ aspectRatio: ratioFor(item, account, 'grid') }} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url && !broken ? url : undefined}
        alt={item.copy ? item.copy.slice(0, 80) : `Contenuto del ${item.date}`}
        loading="lazy"
        onError={() => setBroken(true)}
        className={url && !broken ? undefined : 'is-broken'}
      />
      {item.sponsored && (
        <span className="cv-spon">
          <i />
          Sponsor
        </span>
      )}
      {item.type === 'carousel' && (
        <>
          <span className="cv-mark-tr">Car {item.slides.length || ''}</span>
          {item.slides[0]?.videoUrl && <span className="cv-play" />}
        </>
      )}
      {item.type === 'reel' && (
        <>
          <span className="cv-mark-tr">Reel</span>
          <span className="cv-play" />
        </>
      )}
      {item.date && <span className="cv-mark-bl">{fmtDay(item.date)}</span>}
    </div>
  );
}

function PostDetail({
  item,
  cur,
  pvItemsCount,
  slideIdx,
  layout,
  account,
  client,
  handle,
}: {
  item: ItemRow;
  cur: { url: string; videoUrl: string; copy: string };
  pvItemsCount: number;
  slideIdx: number;
  layout: 'ig' | 'fb' | 'stack';
  account: AccountRow | null;
  client: ClientRow;
  handle: string;
}) {
  const vsrc = item.type === 'reel' ? safeVideoUrl(item.video_url) : item.type === 'carousel' ? safeVideoUrl(cur.videoUrl) : '';
  const clientLogo = safeUrl(client.logo_url);

  function avatar(ring: boolean) {
    return (
      <span className={'pv-av' + (ring ? ' pv-av--ring' : '')} style={clientLogo ? undefined : { background: client.color || '#333', color: onColor(client.color) }}>
        {clientLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clientLogo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          initials(client.name)[0]
        )}
      </span>
    );
  }

  const media = (
    <div className="pv-media" style={{ aspectRatio: ratioFor(item, account, 'detail') }}>
      {vsrc ? (
         
        <video src={vsrc} poster={safeUrl(cur.url) || undefined} muted loop playsInline controls />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={safeUrl(cur.url) || undefined}
            alt={item.copy ? item.copy.slice(0, 90) : ''}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = '.25';
            }}
          />
          {(item.type === 'reel' || (item.type === 'carousel' && cur.videoUrl)) && <span className="cv-play" />}
        </>
      )}
      {pvItemsCount > 1 && (
        <div className="pv-dots">
          {Array.from({ length: pvItemsCount }).map((_, i) => (
            <i key={i} className={i === slideIdx ? 'on' : undefined} />
          ))}
        </div>
      )}
    </div>
  );

  if (layout === 'ig') {
    return (
      <div className="pv-card">
        {media}
        <div className="pv-side">
          <div className="pv-hd">
            {avatar(true)}
            <div>
              <div className="pv-user">{handle}</div>
              <div className="pv-sub">{client.name}</div>
            </div>
            <span className="pv-more">···</span>
          </div>
          <div className="pv-body">
            <div className="pv-caption">
              <b>{handle}</b>
              {item.copy}
            </div>
            {cur.copy && <div className="pv-slide-copy">{cur.copy}</div>}
          </div>
          {item.sponsored && <div className="pv-spon-note">Sponsorizzato</div>}
          <div className="pv-actions">
            <div className="pv-icons">
              <MiniIcon d={IC.heart} />
              <MiniIcon d={IC.comment} />
              <MiniIcon d={IC.send} />
              <span className="sp">
                <MiniIcon d={IC.save} />
              </span>
            </div>
            <div className="pv-likes">Piace a molti</div>
            <div className="pv-date">{longDate(item.date)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pv-card pv-card--stack">
      <div className="pv-fb-hd">
        {avatar(false)}
        <div>
          <div className="pv-user">{handle}</div>
          <div className="pv-sub">{longDate(item.date)}</div>
        </div>
        <span className="pv-more">···</span>
      </div>
      {item.sponsored && <div className="pv-spon-note">Sponsorizzato</div>}
      {item.copy && <div className="pv-fb-copy">{item.copy}</div>}
      {media}
      <div className="pv-fb-actions">
        <span>Mi piace</span>
        <span>Commenta</span>
        <span>Condividi</span>
      </div>
    </div>
  );
}
