import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { Icon } from '@/components/Icon';
import { ClientEditForm, ClientDangerZone } from '@/components/ClientEditForm';
import { ClientAccessCard } from '@/components/ClientAccessCard';

export default async function ClientEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: pillars }, { data: accounts }, { data: portalUsers }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('pillars').select('*').eq('client_id', id).order('name'),
    supabase.from('accounts').select('*').eq('client_id', id).order('created_at'),
    supabase.from('profiles').select('name').eq('client_id', id).eq('kind', 'client'),
  ]);

  if (!client) notFound();

  return (
    <PageFrame>
      <div className="page">
        <Link href="/clients" className="back">
          <Icon name="left" size={12} />
          Tutti i clienti
        </Link>

        <div className="page-hd">
          <div>
            <h1 className="page-title">{client.name || 'Cliente'}</h1>
            <p className="page-sub">Le modifiche si salvano da sole</p>
          </div>
          <div style={{ flex: 1 }} />
          <div className="f-row">
            <Link href={`/content/${client.id}`} className="btn">
              <Icon name="layers" size={13} />
              Contenuti
            </Link>
          </div>
        </div>

        <ClientEditForm client={client} pillars={pillars ?? []} accounts={accounts ?? []} />

        <div className="form-grid" style={{ marginTop: 15 }}>
          <ClientAccessCard clientId={client.id} existingUsers={portalUsers ?? []} />
          <ClientDangerZone clientId={client.id} clientName={client.name} />
        </div>
      </div>
    </PageFrame>
  );
}
