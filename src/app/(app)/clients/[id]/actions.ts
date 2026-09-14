'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type ClientPatch = Partial<Database['public']['Tables']['clients']['Update']>;

export async function updateClient(clientId: string, patch: ClientPatch) {
  const supabase = await createClient();
  const { error } = await supabase.from('clients').update(patch).eq('id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/clients');
}

export async function deleteClient(clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath('/clients');
  redirect('/clients');
}

export async function addPillar(clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('pillars').insert({ client_id: clientId, name: 'Nuova categoria', color: '#5B50E6' });
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function updatePillar(clientId: string, pillarId: string, patch: { name?: string; color?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.from('pillars').update(patch).eq('id', pillarId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function removePillar(clientId: string, pillarId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('pillars').delete().eq('id', pillarId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function addAccount(clientId: string, platform: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').insert({ client_id: clientId, platform: platform as Database['public']['Tables']['accounts']['Row']['platform'] });
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function updateAccount(
  clientId: string,
  accountId: string,
  patch: Partial<Database['public']['Tables']['accounts']['Update']>
) {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').update(patch).eq('id', accountId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}

export async function removeAccount(clientId: string, accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('accounts').delete().eq('id', accountId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}
