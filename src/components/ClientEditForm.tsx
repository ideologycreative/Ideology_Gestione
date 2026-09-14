'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { initials, safeUrl, onColor } from '@/lib/utils';
import { useDebouncedCommit } from '@/lib/use-debounced-commit';
import type { Database } from '@/lib/supabase/types';
import {
  updateClient,
  deleteClient,
  addPillar,
  updatePillar,
  removePillar,
  addAccount,
  updateAccount,
  removeAccount,
} from '@/app/(app)/clients/[id]/actions';

type ClientRow = Database['public']['Tables']['clients']['Row'];
type PillarRow = Database['public']['Tables']['pillars']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];

const SWATCHES = ['#5B50E6', '#0D9488', '#E11D48', '#FB7185', '#0EA5E9', '#8B5CF6', '#10B981', '#94A3B8'];
const PLATFORMS: Record<AccountRow['platform'], { label: string; feed: string }> = {
  Instagram: { label: 'Instagram', feed: '4/5' },
  Facebook: { label: 'Facebook', feed: '1/1' },
  TikTok: { label: 'TikTok', feed: '9/16' },
  LinkedIn: { label: 'LinkedIn', feed: '1/1' },
  YouTube: { label: 'YouTube', feed: '16/9' },
  Pinterest: { label: 'Pinterest', feed: '2/3' },
  Threads: { label: 'Threads', feed: '4/5' },
};

export function ClientEditForm({
  client,
  pillars: initialPillars,
  accounts: initialAccounts,
}: {
  client: ClientRow;
  pillars: PillarRow[];
  accounts: AccountRow[];
}) {
  const router = useRouter();
  const debounced = useDebouncedCommit();

  const [name, setName] = useState(client.name);
  const [color, setColor] = useState(client.color);
  const [hex, setHex] = useState(client.color);
  const [hexInvalid, setHexInvalid] = useState(false);
  const [theme, setThemeLocal] = useState<'dark' | 'light'>(client.theme);
  const [note, setNote] = useState(client.note);
  const [logoUrl, setLogoUrl] = useState(client.logo_url);
  const [pillars, setPillars] = useState(initialPillars);
  const [accounts, setAccounts] = useState(initialAccounts);

  function commitColor(v: string) {
    setColor(v);
    setHex(v);
    setHexInvalid(false);
    void updateClient(client.id, { color: v });
  }

  function onHexInput(v: string) {
    setHex(v);
    const withHash = v && v[0] !== '#' ? '#' + v : v;
    if (!/^#[0-9a-f]{6}$/i.test(withHash)) {
      setHexInvalid(true);
      return;
    }
    setHexInvalid(false);
    setColor(withHash);
    debounced('client-color', () => void updateClient(client.id, { color: withHash }));
  }

  async function onLogoFile(file: File) {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    setLogoUrl(dataUrl);
    await updateClient(client.id, { logo_url: dataUrl });
  }

  return (
    <div className="form-grid">
      {/* ── Identity ──────────────────────────────────────────────────── */}
      <section className="card-panel card-panel--span">
        <h2 className="panel-t">Identità</h2>

        <div className="f">
          <label className="f-label">Nome azienda</label>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              debounced('client-name', () => void updateClient(client.id, { name: e.target.value }));
            }}
          />
        </div>

        <div className="f">
          <label className="f-label">Colore</label>
          <div className="swatches">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                className={'swatch' + (color.toLowerCase() === s.toLowerCase() ? ' is-on' : '')}
                style={{ background: s }}
                aria-label={s}
                title={s}
                onClick={() => commitColor(s)}
              />
            ))}
            <input
              className="color-native"
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#5B50E6'}
              aria-label="Colore personalizzato"
              onChange={(e) => commitColor(e.target.value)}
            />
            <input
              className={'input hexinput' + (hexInvalid ? ' is-invalid' : '')}
              type="text"
              maxLength={7}
              placeholder="#RRGGBB"
              aria-label="Codice colore esadecimale"
              value={hex}
              onChange={(e) => onHexInput(e.target.value)}
            />
          </div>
          <p className="f-hint">Un preset, il selettore, o incolla direttamente un codice esadecimale.</p>
        </div>

        <div className="f">
          <label className="f-label">Sfondo portale</label>
          <div className="theme-pick">
            {(
              [
                { id: 'dark', label: 'Scuro', bg: '#101010', fg: '#f2f2f2' },
                { id: 'light', label: 'Chiaro', bg: '#ffffff', fg: '#101010' },
              ] as const
            ).map((t) => {
              const on = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={'theme-tile' + (on ? ' is-on' : '')}
                  aria-pressed={on}
                  onClick={() => {
                    setThemeLocal(t.id);
                    void updateClient(client.id, { theme: t.id });
                  }}
                >
                  <span className="theme-swatch" style={{ background: t.bg, color: t.fg }}>
                    <i style={{ background: color || '#5B50E6' }} />
                  </span>
                  <span className="theme-lbl">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="f-hint">
            Come vedrà il piano il cliente quando accede. Lo sfondo scuro è quello dello studio; il chiaro è pensato
            per un cliente il cui lavoro rende meglio su bianco.
          </p>
        </div>

        <div className="f">
          <label className="f-label">Logo</label>
          <div className="logo-row">
            {safeUrl(logoUrl) ? (
              <img className="logo-prev" src={safeUrl(logoUrl)} alt={`Logo ${name}`} />
            ) : (
              <span className="logo-prev logo-prev--txt" style={{ background: color || 'var(--brand)', color: onColor(color) }}>
                {initials(name)}
              </span>
            )}
            <label className="btn" style={{ cursor: 'pointer' }}>
              <Icon name="image" size={13} />
              Carica
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLogoFile(f);
                }}
              />
            </label>
            {safeUrl(logoUrl) && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setLogoUrl('');
                  void updateClient(client.id, { logo_url: '' });
                }}
              >
                Rimuovi
              </button>
            )}
          </div>
          <p className="f-hint">PNG o SVG con sfondo trasparente. In mancanza si usano le iniziali.</p>
        </div>

        <div className="f">
          <label className="f-label">Note interne</label>
          <textarea
            className="input input--area"
            rows={3}
            placeholder="Tono di voce, vincoli, referente…"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              debounced('client-note', () => void updateClient(client.id, { note: e.target.value }));
            }}
          />
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────────── */}
      <section className="card-panel card-panel--span">
        <h2 className="panel-t">Categorie di contenuto</h2>
        <p className="panel-sub">
          Che tipo di contenuto è: recensione cliente, prodotto, servizio, educational, prima/dopo… Appaiono come
          chip su ogni post.
        </p>

        {pillars.map((cat) => (
          <div className="cat-row" key={cat.id}>
            <input
              className="color-native color-native--sm"
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(cat.color) ? cat.color : '#0D9488'}
              aria-label="Colore categoria"
              onChange={(e) => {
                setPillars((ps) => ps.map((p) => (p.id === cat.id ? { ...p, color: e.target.value } : p)));
                void updatePillar(client.id, cat.id, { color: e.target.value });
              }}
            />
            <input
              className="input"
              type="text"
              value={cat.name}
              aria-label="Nome categoria"
              onChange={(e) => {
                const v = e.target.value;
                setPillars((ps) => ps.map((p) => (p.id === cat.id ? { ...p, name: v } : p)));
                debounced('cat-name-' + cat.id, () => void updatePillar(client.id, cat.id, { name: v }));
              }}
            />
            <button
              type="button"
              className="iconbtn"
              aria-label="Elimina categoria"
              title="Elimina categoria"
              onClick={() => {
                if (!confirm(`Eliminare la categoria "${cat.name}"? I contenuti già taggati manterranno l'etichetta.`)) return;
                setPillars((ps) => ps.filter((p) => p.id !== cat.id));
                void removePillar(client.id, cat.id);
              }}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}

        {pillars.length === 0 && <p className="panel-empty">Nessuna categoria ancora.</p>}

        <button
          type="button"
          className="btn"
          onClick={async () => {
            await addPillar(client.id);
            router.refresh();
          }}
        >
          <Icon name="plus" size={13} />
          Aggiungi categoria
        </button>
      </section>

      {/* ── Accounts ──────────────────────────────────────────────────── */}
      <section className="card-panel card-panel--span">
        <h2 className="panel-t">Account social</h2>
        <p className="panel-sub">Il formato di ogni piattaforma decide le proporzioni della griglia, nel pannello e nel portale cliente.</p>

        {accounts.map((a) => (
          <div className="acc-row" key={a.id}>
            <div className="acc-main">
              <select
                className="input"
                aria-label="Piattaforma"
                value={a.platform}
                onChange={(e) => {
                  const platform = e.target.value as AccountRow['platform'];
                  setAccounts((as) => as.map((x) => (x.id === a.id ? { ...x, platform } : x)));
                  void updateAccount(client.id, a.id, { platform });
                }}
              >
                {Object.entries(PLATFORMS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="text"
                placeholder="Nome pagina"
                aria-label="Nome account"
                value={a.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setAccounts((as) => as.map((x) => (x.id === a.id ? { ...x, name: v } : x)));
                  debounced('acc-name-' + a.id, () => void updateAccount(client.id, a.id, { name: v }));
                }}
              />
              <input
                className="input"
                type="text"
                placeholder="@username"
                aria-label="Username"
                value={a.handle}
                onChange={(e) => {
                  const v = e.target.value;
                  setAccounts((as) => as.map((x) => (x.id === a.id ? { ...x, handle: v } : x)));
                  debounced('acc-handle-' + a.id, () => void updateAccount(client.id, a.id, { handle: v }));
                }}
              />
            </div>
            <div className="acc-side">
              <span className="acc-ratio">{PLATFORMS[a.platform].feed.replace('/', ':')}</span>
              <button
                type="button"
                className="iconbtn"
                aria-label="Rimuovi account"
                title="Rimuovi — cancella anche i suoi contenuti"
                onClick={() => {
                  if (!confirm('Rimuovere questo account? I contenuti collegati verranno eliminati.')) return;
                  setAccounts((as) => as.filter((x) => x.id !== a.id));
                  void removeAccount(client.id, a.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
            {/* Meta page binding lands here in the next pass — this row is
                ready for it (accounts already carry meta_connection_id /
                meta_page_id / meta_ig_user_id). */}
          </div>
        ))}

        {accounts.length === 0 && <p className="panel-empty">Nessun account collegato.</p>}

        <button
          type="button"
          className="btn"
          onClick={async () => {
            await addAccount(client.id, 'Instagram');
            router.refresh();
          }}
        >
          <Icon name="plus" size={13} />
          Aggiungi account
        </button>
      </section>
    </div>
  );
}

/** Kept last on the page, deliberately — a page composing this and
    ClientEditForm together renders it after everything else, Access card
    included. */
export function ClientDangerZone({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <section className="card-panel card-panel--danger card-panel--span">
      <h2 className="panel-t">Elimina cliente</h2>
      <p className="panel-sub">Rimuove il cliente e tutti i suoi contenuti, account e piani. Irreversibile.</p>
      <button
        type="button"
        className="btn btn--danger"
        onClick={() => {
          if (!confirm(`Eliminare "${clientName}" e tutti i suoi contenuti? Non è reversibile.`)) return;
          void deleteClient(clientId);
        }}
      >
        <Icon name="trash" size={13} />
        Elimina {clientName || 'cliente'}
      </button>
    </section>
  );
}
