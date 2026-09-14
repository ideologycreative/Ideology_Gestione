import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { ClientTile } from '@/components/ClientTile';
import { Icon } from '@/components/Icon';
import { getClientProgressMap } from '@/lib/client-progress';
import { createNewClient } from './actions';

export default async function ClientsPage() {
  const supabase = await createClient();
  const [{ data: clients }, progressMap] = await Promise.all([
    supabase.from('clients').select('id, name, color, logo_url, accounts(platform)').order('name'),
    getClientProgressMap(),
  ]);

  const list = clients ?? [];

  return (
    <PageFrame>
      <div className="page">
        <div className="page-hd">
          <div>
            <h1 className="page-title">Clienti</h1>
            <p className="page-sub">{list.length} in gestione</p>
          </div>
          <div style={{ flex: 1 }} />
          <form action={createNewClient}>
            <button className="btn btn--primary" type="submit">
              <Icon name="plus" size={13} />
              Nuovo cliente
            </button>
          </form>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <p>Nessun cliente. Aggiungine uno per iniziare.</p>
          </div>
        ) : (
          <div className="tiles">
            {list.map((c) => (
              <ClientTile
                key={c.id}
                client={c}
                accounts={(c.accounts as unknown as { platform: string }[] | null)?.map((a) => a.platform) ?? []}
                progress={progressMap[c.id]}
              />
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
