'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { safeUrl } from '@/lib/utils';
import { setStudioLogo } from '@/app/(app)/settings/actions';
import { signOutStudio } from '@/lib/sign-out';

export function SettingsForm({ logoUrl: initialLogo, email, name }: { logoUrl: string; email: string; name: string }) {
  const [logoUrl, setLogoUrl] = useState(initialLogo);

  async function onFile(file: File) {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    setLogoUrl(dataUrl);
    await setStudioLogo(dataUrl);
  }

  return (
    <div className="form-grid">
      <section className="card-panel card-panel--span">
        <h2 className="panel-t">Logo Ideology</h2>
        <p className="panel-sub">Compare in cima al portale di ogni cliente. Senza logo si usa il monogramma !d.</p>
        <div className="logo-row">
          {safeUrl(logoUrl) ? (
            <img className="logo-prev" src={safeUrl(logoUrl)} alt="Logo Ideology" />
          ) : (
            <span className="logo-prev logo-prev--txt" style={{ background: 'var(--brand)', color: 'var(--brand-on)' }}>
              !d
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
                if (f) void onFile(f);
              }}
            />
          </label>
          {safeUrl(logoUrl) && (
            <button
              className="btn"
              onClick={() => {
                setLogoUrl('');
                void setStudioLogo('');
              }}
            >
              Rimuovi
            </button>
          )}
        </div>
        <p className="f-hint">PNG o SVG, sfondo trasparente, orizzontale.</p>
      </section>

      <section className="card-panel">
        <h2 className="panel-t">Il tuo accesso</h2>
        <p className="panel-sub">
          {name || email} · {email}
        </p>
        <form action={signOutStudio}>
          <button className="btn btn--danger" type="submit">
            Esci
          </button>
        </form>
      </section>
    </div>
  );
}
