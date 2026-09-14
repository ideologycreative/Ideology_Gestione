'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

/**
 * Replaces legacy/src/app/sections.js's "Portale cliente" share-link card —
 * there's no bare link anymore (Phase A moved the portal to real per-client
 * logins), so this is an invite form instead, hitting the existing
 * /api/invite-client route.
 */
export function ClientAccessCard({
  clientId,
  existingUsers,
}: {
  clientId: string;
  existingUsers: { name: string }[];
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function invite() {
    setStatus('sending');
    setErrorMsg('');
    const res = await fetch('/api/invite-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, clientId, name }),
    });
    if (res.ok) {
      setStatus('sent');
      setEmail('');
      setName('');
    } else {
      const body = await res.json().catch(() => ({}));
      setErrorMsg(body.error || 'Invito non riuscito');
      setStatus('error');
    }
  }

  return (
    <section className="card-panel card-panel--span">
      <h2 className="panel-t">Accesso cliente</h2>
      <p className="panel-sub">
        Il cliente accede con un vero login, non più un link condiviso. Invita un referente qui — riceverà
        un&apos;email per impostare la password.
      </p>

      {existingUsers.length > 0 && (
        <div className="cat-row" style={{ flexWrap: 'wrap' }}>
          {existingUsers.map((u, i) => (
            <span key={i} className="chip">
              {u.name || 'Referente'}
            </span>
          ))}
        </div>
      )}

      <div className="f-row">
        <div className="f">
          <label className="f-label">Nome</label>
          <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="f">
          <label className="f-label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>

      <button type="button" className="btn btn--primary" disabled={!email || status === 'sending'} onClick={invite}>
        <Icon name="external" size={13} />
        {status === 'sending' ? 'Invio…' : 'Invita'}
      </button>

      {status === 'sent' && <p className="f-hint">Invito inviato.</p>}
      {status === 'error' && <p className="f-hint" style={{ color: 'var(--danger-text)' }}>{errorMsg}</p>}
    </section>
  );
}
