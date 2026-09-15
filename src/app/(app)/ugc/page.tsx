import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { ClientTile } from '@/components/ClientTile';
import { getClientProgressMap } from '@/lib/client-progress';

export default async function UgcPickerPage() {
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
            <h1 className="page-title">UGC</h1>
            <p className="page-sub">Scegli un cliente per gestire i brief creator</p>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <p>Nessun cliente ancora.</p>
          </div>
        ) : (
          <div className="tiles">
            {list.map((c) => (
              <ClientTile
                key={c.id}
                client={c}
                href={`/ugc/${c.id}`}
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
