'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { Thumb } from '@/components/content/Thumb';
import { STATUSES, TYPES, statusOf, ratioFor } from '@/lib/platforms';
import { safeUrl } from '@/lib/utils';
import { useDebouncedCommit } from '@/lib/use-debounced-commit';
import {
  patchItem,
  removeItem,
  setTargets,
  setStoryLink,
} from '@/app/(app)/content/[clientId]/actions';
import type { Database, Slide } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type PillarRow = Database['public']['Tables']['pillars']['Row'];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="f">
      <label className="f-label">{label}</label>
      {children}
      {hint && <p className="f-hint">{hint}</p>}
    </div>
  );
}

/**
 * Ported from legacy/src/app/inspector.js — same anatomy, same field order.
 * The asset-fit warning (measuring the real image/video dimensions against
 * the placement ratio) isn't in this pass yet.
 */
export function InspectorPanel({
  clientId,
  item,
  account,
  accounts,
  pillars,
  hasStoryLink,
  targetAccountIds,
  onClose,
  onClosedByRemoval,
}: {
  clientId: string;
  item: ItemRow;
  account: AccountRow;
  accounts: AccountRow[];
  pillars: PillarRow[];
  hasStoryLink: boolean;
  /** Account ids this item's group currently publishes to (across every channel it goes out on). */
  targetAccountIds: string[];
  onClose: () => void;
  onClosedByRemoval: (nextId: string | null, nextAccountId: string | null) => void;
}) {
  const debounced = useDebouncedCommit();
  const [copy, setCopy] = useState(item.copy);
  const [note, setNote] = useState(item.note);
  const [url, setUrl] = useState(item.url);
  const [videoUrl, setVideoUrl] = useState(item.video_url);
  const [slides, setSlides] = useState<Slide[]>((item.slides as Slide[]) ?? []);

  const st = statusOf(item.appr_stato);
  const placement = ratioFor(item, account, 'detail');

  function commitSlides(next: Slide[]) {
    setSlides(next);
    const cover = next[0];
    void patchItem(clientId, item.id, {
      slides: next,
      url: cover?.url || '',
      external_url: cover?.url || '',
    });
  }

  return (
    <>
      <div className="insp-hd">
        <span className="insp-kind">{item.kind === 'story' ? 'STORY' : 'POST'}</span>
        <span className="insp-id">{item.id.slice(0, 8)}</span>
        <div style={{ flex: 1 }} />
        <button className="iconbtn" aria-label="Chiudi pannello" title="Chiudi (Esc)" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>

      {item.client_note && (
        <div className="insp-client">
          <span className="insp-client-hd">Richiesta di {item.client_name || 'cliente'}</span>
          <p>{item.client_note}</p>
        </div>
      )}

      <div className="insp-body">
        <Thumb item={item} ratio={placement} />

        {/* ── Status ────────────────────────────────────────────────── */}
        <Field label="Stato" hint={st.hint}>
          <div className="statelist" role="radiogroup" aria-label="Stato">
            {STATUSES.map((s) => {
              const on = item.appr_stato === s.id;
              return (
                <button
                  key={s.id}
                  className={'state' + (on ? ' is-on' : '')}
                  role="radio"
                  aria-checked={on}
                  data-s={s.id}
                  title={s.hint}
                  onClick={() => {
                    if (on) return;
                    void patchItem(clientId, item.id, { appr_stato: s.id });
                  }}
                >
                  <span className="state-tok">{s.token}</span>
                  <span className="state-lbl">{s.label}</span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* ── Channels ──────────────────────────────────────────────── */}
        {accounts.length > 1 && (
          <Field
            label="Pubblica su"
            hint={
              targetAccountIds.length > 1
                ? 'Immagine, caption e data restano uguali su tutti i canali. Approvazione separata.'
                : 'Seleziona un altro canale per pubblicare lo stesso contenuto anche lì.'
            }
          >
            <div className="targets">
              {accounts.map((a) => {
                const on = targetAccountIds.includes(a.id);
                const locked = on && targetAccountIds.length === 1;
                const pf = a.platform;
                return (
                  <button
                    key={a.id}
                    className={'target' + (on ? ' is-on' : '')}
                    role="switch"
                    aria-checked={on}
                    disabled={locked}
                    title={locked ? 'Un contenuto deve restare su almeno un canale' : pf}
                    onClick={async () => {
                      const next = on ? targetAccountIds.filter((x) => x !== a.id) : [...targetAccountIds, a.id];
                      if (!next.length) return;
                      const res = await setTargets(clientId, item.id, next);
                      if (res.removedSelf) onClosedByRemoval(res.nextId, res.nextAccountId);
                    }}
                  >
                    <span className="target-box">{on && <Icon name="check" size={11} />}</span>
                    <span className="target-name">{a.platform}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* ── Feed ⇄ Story ──────────────────────────────────────────── */}
        <Field
          label={item.kind === 'story' ? 'Anche nei Post' : 'Anche nelle Storie'}
          hint={
            item.kind === 'story'
              ? 'Pubblica lo stesso contenuto anche nel feed di questo account.'
              : 'Pubblica lo stesso contenuto anche nelle Storie di questo account.'
          }
        >
          <button
            className={'toggle' + (hasStoryLink ? ' is-on' : '')}
            role="switch"
            aria-checked={hasStoryLink}
            onClick={() => void setStoryLink(clientId, item.id, !hasStoryLink)}
          >
            <span className="toggle-track">
              <i />
            </span>
            <Icon name="layers" size={13} />
            <span>{hasStoryLink ? 'Collegato' : 'Indipendente'}</span>
          </button>
        </Field>

        {/* ── Sponsored ─────────────────────────────────────────────── */}
        <Field label="Sponsorizzazione" hint={item.sponsored ? 'Il cliente vedrà il badge SPONSOR sul contenuto.' : 'Attiva per i contenuti a pagamento.'}>
          <button
            className={'toggle' + (item.sponsored ? ' is-on' : '')}
            role="switch"
            aria-checked={item.sponsored}
            onClick={() => void patchItem(clientId, item.id, { sponsored: !item.sponsored })}
          >
            <span className="toggle-track">
              <i />
            </span>
            <Icon name="megaphone" size={13} />
            <span>{item.sponsored ? 'Sponsorizzato' : 'Organico'}</span>
          </button>
        </Field>

        {/* ── Caption ───────────────────────────────────────────────── */}
        <Field label="Caption" hint={`${copy.length} caratteri`}>
          <textarea
            className="input input--area"
            rows={5}
            placeholder="Scrivi la caption…"
            aria-label="Caption"
            value={copy}
            onChange={(e) => {
              setCopy(e.target.value);
              debounced('copy', () => void patchItem(clientId, item.id, { copy: e.target.value }));
            }}
          />
        </Field>

        {/* ── Date + type ───────────────────────────────────────────── */}
        <div className="f-row">
          <Field label="Data">
            <input
              className="input"
              type="date"
              aria-label="Data di pubblicazione"
              defaultValue={item.date}
              onChange={(e) => void patchItem(clientId, item.id, { date: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <select
              className="input"
              aria-label="Formato"
              defaultValue={item.type}
              onChange={(e) => void patchItem(clientId, item.id, { type: e.target.value as ItemRow['type'] })}
            >
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* ── Category ──────────────────────────────────────────────── */}
        {pillars.length > 0 && (
          <Field label="Categoria" hint="Aggiungi o modifica le categorie dalla scheda del cliente.">
            <div className="chips">
              {pillars.map((p) => {
                const on = item.pillar_id === p.id;
                return (
                  <button
                    key={p.id}
                    className={'chip' + (on ? ' is-on' : '')}
                    aria-pressed={on}
                    onClick={() => void patchItem(clientId, item.id, { pillar_id: on ? null : p.id })}
                  >
                    <i style={{ background: p.color }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* ── Media ─────────────────────────────────────────────────── */}
        {item.type !== 'carousel' && (
          <Field label="Media">
            <input
              className="input"
              type="text"
              placeholder="https://…"
              aria-label="URL immagine"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                debounced('url', () => void patchItem(clientId, item.id, { url: e.target.value, external_url: e.target.value }));
              }}
            />
            {safeUrl(url) && (
              <div className="f-row" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  onClick={() => {
                    setUrl('');
                    void patchItem(clientId, item.id, { url: '', external_url: '' });
                  }}
                >
                  Rimuovi
                </button>
              </div>
            )}
          </Field>
        )}

        {/* ── Carousel slides ───────────────────────────────────────── */}
        {item.type === 'carousel' && (
          <Field
            label={`Slide del carosello (${slides.length})`}
            hint="La prima slide è la copertina mostrata in griglia. Una slide con video mostra la sua immagine finché non viene aperta."
          >
            <div className="slide-editor">
              {slides.map((sl, i) => {
                const purl = safeUrl(sl.url || sl.externalUrl);
                return (
                  <div className="slide-row" key={i}>
                    <div className="slide-prev">
                      {purl ? <img src={purl} alt="" /> : <Icon name="image" size={16} />}
                      {sl.videoUrl && <span className="slide-vtag">VIDEO</span>}
                    </div>
                    <div className="slide-body">
                      <input
                        className="input input--sm"
                        type="text"
                        placeholder="URL immagine"
                        aria-label={`Immagine slide ${i + 1}`}
                        defaultValue={sl.url}
                        onChange={(e) => {
                          const v = e.target.value;
                          debounced(`slide-img-${i}`, () => {
                            const next = slides.slice();
                            next[i] = { ...next[i], url: v, externalUrl: v };
                            commitSlides(next);
                          });
                        }}
                      />
                      <input
                        className="input input--sm"
                        type="text"
                        placeholder="URL video (opzionale)"
                        aria-label={`Video slide ${i + 1}`}
                        defaultValue={sl.videoUrl}
                        onChange={(e) => {
                          const v = e.target.value;
                          debounced(`slide-video-${i}`, () => {
                            const next = slides.slice();
                            next[i] = { ...next[i], videoUrl: v };
                            commitSlides(next);
                          });
                        }}
                      />
                    </div>
                    <div className="slide-side">
                      <button
                        className="iconbtn"
                        aria-label="Sposta su"
                        title="Sposta su"
                        disabled={i === 0}
                        onClick={() => {
                          const next = slides.slice();
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          commitSlides(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="iconbtn"
                        aria-label="Sposta giù"
                        title="Sposta giù"
                        disabled={i === slides.length - 1}
                        onClick={() => {
                          const next = slides.slice();
                          [next[i + 1], next[i]] = [next[i], next[i + 1]];
                          commitSlides(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        className="iconbtn"
                        aria-label="Elimina slide"
                        title="Elimina slide"
                        onClick={() => {
                          const next = slides.slice();
                          next.splice(i, 1);
                          commitSlides(next);
                        }}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => commitSlides([...slides, { url: '', externalUrl: '', videoUrl: '', name: '', copy: '', note: '' }])}
              >
                <Icon name="plus" size={13} />
                Aggiungi slide
              </button>
            </div>
          </Field>
        )}

        {/* ── Video (reel) ──────────────────────────────────────────── */}
        {item.type === 'reel' && (
          <Field label="Video del reel" hint={videoUrl ? 'Il cliente lo vedrà partire aprendo il post.' : 'Senza video il cliente vede solo la copertina.'}>
            <input
              className="input"
              type="text"
              placeholder="https://….mp4"
              aria-label="URL video"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                debounced('video', () => void patchItem(clientId, item.id, { video_url: e.target.value }));
              }}
            />
          </Field>
        )}

        {/* ── Internal note ─────────────────────────────────────────── */}
        <Field label="Nota interna">
          <textarea
            className="input input--area"
            rows={2}
            placeholder="Nota interna, non visibile al cliente"
            aria-label="Nota interna"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              debounced('note', () => void patchItem(clientId, item.id, { note: e.target.value }));
            }}
          />
        </Field>
      </div>

      <div className="insp-ft">
        <button
          className="btn btn--danger"
          onClick={() => {
            if (!confirm("Eliminare questo contenuto? L'azione non è reversibile.")) return;
            void removeItem(clientId, item.id);
            onClose();
          }}
        >
          <Icon name="trash" size={13} />
          Elimina
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={() => void patchItem(clientId, item.id, { appr_stato: 'approvare' })}>
          <Icon name="check" size={13} />
          Invia al cliente
        </button>
      </div>
    </>
  );
}
