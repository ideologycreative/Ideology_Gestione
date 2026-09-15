import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import { connectionStatus } from '@/lib/meta-status';

type PageRow = Database['public']['Tables']['meta_pages']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];

export type { ConnectionStatus } from '@/lib/meta-status';
export { connectionStatus, connectionDaysLeft } from '@/lib/meta-status';

export async function getConnectionsWithPages() {
  const supabase = await createClient();
  const { data: connections } = await supabase.from('meta_connections').select('*').order('connected_at', { ascending: false });
  const { data: pages } = await supabase.from('meta_pages').select('*');
  const byConn = new Map<string, PageRow[]>();
  for (const p of pages ?? []) {
    const list = byConn.get(p.connection_id) ?? [];
    list.push(p);
    byConn.set(p.connection_id, list);
  }
  return (connections ?? []).map((c) => ({ ...c, pages: byConn.get(c.id) ?? [] }));
}

/** Every page across every connection, tagged with the connection it came from — what the binding picker lists. */
export async function getAllMetaPages(): Promise<(PageRow & { connectionName: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('meta_pages').select('*, meta_connections!inner(account_name)');
  return (data ?? []).map((p) => {
    const { meta_connections, ...rest } = p as unknown as PageRow & { meta_connections: { account_name: string } };
    return { ...rest, connectionName: meta_connections.account_name };
  });
}

export type MetaPageWithBinding = PageRow & { connectionName: string; takenByAccountId: string | null; takenByClientName: string | null };

/** Every page, plus which account (if any) currently holds it and that account's client name — what the client-editor's binding picker needs to show "(già su X)" and disable it. */
export async function getAllMetaPagesWithBindings(): Promise<MetaPageWithBinding[]> {
  const supabase = await createClient();
  const [pages, { data: boundAccounts }] = await Promise.all([
    getAllMetaPages(),
    supabase.from('accounts').select('id, meta_connection_id, meta_page_id, clients(name)').not('meta_page_id', 'is', null),
  ]);

  const takenMap = new Map<string, { accountId: string; clientName: string }>();
  for (const a of boundAccounts ?? []) {
    if (!a.meta_connection_id || !a.meta_page_id) continue;
    takenMap.set(`${a.meta_connection_id}|${a.meta_page_id}`, {
      accountId: a.id,
      clientName: (a.clients as unknown as { name: string } | null)?.name ?? '',
    });
  }

  return pages.map((p) => {
    const taken = takenMap.get(`${p.connection_id}|${p.page_id}`);
    return { ...p, takenByAccountId: taken?.accountId ?? null, takenByClientName: taken?.clientName ?? null };
  });
}

/** Which client + account, if any, already publishes to this page — excluding one account (the one you're currently editing). */
export async function pageBoundTo(connectionId: string, pageId: string, exceptAccountId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('accounts')
    .select('id, platform, client_id, clients(name)')
    .eq('meta_connection_id', connectionId)
    .eq('meta_page_id', pageId);
  if (exceptAccountId) query = query.neq('id', exceptAccountId);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const clientName = (data.clients as unknown as { name: string } | null)?.name ?? '';
  return { accountId: data.id, clientId: data.client_id, clientName };
}

/** Ported from legacy/src/app/core.js's bindingIssue() — same four checks, same Italian copy. */
export async function bindingIssue(account: AccountRow): Promise<string | null> {
  if (!account.meta_page_id) return null;
  const supabase = await createClient();

  if (!account.meta_connection_id) {
    return 'La pagina collegata non è più accessibile. Riconnetti l’account Meta o scegli un’altra pagina.';
  }
  const { data: page } = await supabase
    .from('meta_pages')
    .select('*')
    .eq('connection_id', account.meta_connection_id)
    .eq('page_id', account.meta_page_id)
    .maybeSingle();
  if (!page) {
    return 'La pagina collegata non è più accessibile. Riconnetti l’account Meta o scegli un’altra pagina.';
  }
  const { data: conn } = await supabase.from('meta_connections').select('expires_at').eq('id', account.meta_connection_id).single();
  if (conn && connectionStatus(conn) === 'expired') {
    return 'La connessione Meta è scaduta. Riconnetti per continuare a pubblicare.';
  }
  if (account.platform === 'Instagram') {
    if (!page.ig_user_id) return 'Questa pagina non ha un account Instagram collegato.';
    if (page.ig_account_type === 'PERSONAL') {
      return 'L’account Instagram è personale. Serve un account Business o Creator per pubblicare via API.';
    }
  }
  return null;
}

/** Every broken binding across every client, for the Connessioni roll-up warning. */
export async function getAllBindingIssues() {
  const supabase = await createClient();
  const { data: accounts } = await supabase.from('accounts').select('*, clients(id, name)').not('meta_page_id', 'is', null);
  const out: { clientId: string; clientName: string; account: AccountRow; issue: string }[] = [];
  for (const a of accounts ?? []) {
    const issue = await bindingIssue(a);
    if (issue) {
      const client = a.clients as unknown as { id: string; name: string };
      out.push({ clientId: client.id, clientName: client.name, account: a, issue });
    }
  }
  return out;
}
