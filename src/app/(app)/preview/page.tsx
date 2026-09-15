import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { ClientTile } from '@/components/ClientTile';
import { Icon } from '@/components/Icon';
import { getClientProgressMap } from '@/lib/client-progress';

export default async function PreviewPickerPage() {
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
            <h1 className="page-title">Anteprima cliente</h1>
            <p className="page-sub">Quello che il cliente vede quando accede al portale</p>
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
                href={`/preview/${c.id}`}
                accounts={(c.accounts as unknown as { platform: string }[] | null)?.map((a) => a.platform) ?? []}
                progress={progressMap[c.id]}
              />
            ))}
          </div>
        )}

        <p className="note-line">
          <Icon name="eye" size={11} /> L&apos;anteprima mostra i contenuti come li vede il cliente — bozze escluse.
        </p>
      </div>
    </PageFrame>
  );
}
