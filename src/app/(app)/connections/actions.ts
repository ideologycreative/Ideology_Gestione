'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { pageBoundTo } from '@/lib/meta';

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stands in for the real OAuth round trip until Phase E (needs a Meta
 * Developer App ID/Secret — see docs/META-INTEGRATION-PLAN.md §1 and §9).
 * Real flow: redirect to Meta, exchange the code for a token SERVER-SIDE,
 * store it encrypted (meta_connections.access_token_encrypted, already
 * locked out of anon/authenticated SELECT in the schema), return only the
 * page list to the browser.
 */
export async function connectMetaMock() {
  const supabase = await createClient();
  const suffix = randomId('mock');

  const { data: conn, error } = await supabase
    .from('meta_connections')
    .insert({
      meta_account_id: suffix,
      account_name: 'Account demo',
      business_name: 'Business demo',
      expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    })
    .select('id')
    .single();
  if (error || !conn) throw new Error(error?.message || 'Failed to connect');

  await supabase.from('meta_pages').insert([
    { connection_id: conn.id, page_id: `${suffix}_pg1`, name: 'Pagina demo 1', category: 'Attività locale', ig_user_id: `${suffix}_ig1`, ig_username: 'pagina.demo1', ig_account_type: 'BUSINESS' },
    { connection_id: conn.id, page_id: `${suffix}_pg2`, name: 'Pagina demo 2', category: 'Ristorante', ig_user_id: null, ig_username: null, ig_account_type: null },
  ]);

  revalidatePath('/connections');
}

export async function reconnectMetaMock(connectionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('meta_connections')
    .update({ connected_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 86400000).toISOString() })
    .eq('id', connectionId);
  if (error) throw new Error(error.message);
  revalidatePath('/connections');
}

export async function removeConnection(connectionId: string) {
  const supabase = await createClient();
  // Bindings pointing here resolve to broken on their own (meta_connection_id
  // gets ON DELETE SET NULL) rather than being cascaded away — reconnecting
  // the same Meta account restores them.
  const { error } = await supabase.from('meta_connections').delete().eq('id', connectionId);
  if (error) throw new Error(error.message);
  revalidatePath('/connections');
  revalidatePath('/clients');
}

export async function bindAccount(clientId: string, accountId: string, connectionId: string, pageId: string) {
  const supabase = await createClient();
  const { data: page } = await supabase.from('meta_pages').select('*').eq('connection_id', connectionId).eq('page_id', pageId).maybeSingle();
  if (!page) return { ok: false as const, reason: 'Pagina non trovata in questa connessione.' };

  const taken = await pageBoundTo(connectionId, pageId, accountId);
  if (taken) {
    return { ok: false as const, reason: `Questa pagina è già collegata a ${taken.clientName}. Una pagina può appartenere a un solo cliente.` };
  }

  const { error } = await supabase
    .from('accounts')
    .update({ meta_connection_id: connectionId, meta_page_id: pageId, meta_ig_user_id: page.ig_user_id })
    .eq('id', accountId)
    .eq('client_id', clientId);
  if (error) return { ok: false as const, reason: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true as const, pageName: page.name };
}

export async function unbindAccount(clientId: string, accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('accounts')
    .update({ meta_connection_id: null, meta_page_id: null, meta_ig_user_id: null })
    .eq('id', accountId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}
