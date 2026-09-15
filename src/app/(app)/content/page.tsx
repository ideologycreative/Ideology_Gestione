import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { ClientTile } from '@/components/ClientTile';
import { Icon } from '@/components/Icon';
import { getClientProgressMap } from '@/lib/client-progress';
import { thisMonthLabel } from '@/lib/dates';

export default async function ContentPickerPage() {
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
            <h1 className="page-title">Contenuti</h1>
            <p className="page-sub">Scegli un cliente da pianificare · {thisMonthLabel()}</p>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <p>Nessun cliente ancora.</p>
            <Link href="/clients" className="btn btn--primary">
              <Icon name="plus" size={13} />
              Aggiungi un cliente
            </Link>
          </div>
        ) : (
          <div className="tiles">
            {list.map((c) => (
              <ClientTile
                key={c.id}
                client={c}
                href={`/content/${c.id}`}
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
