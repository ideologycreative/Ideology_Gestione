'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type SlotPatch = Partial<Database['public']['Tables']['ugc_slots']['Update']>;

export async function addUgcSlot(clientId: string, date: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('ugc_slots').insert({ client_id: clientId, date });
  if (error) throw new Error(error.message);
  revalidatePath(`/ugc/${clientId}`);
}

export async function updateUgcSlot(clientId: string, slotId: string, patch: SlotPatch) {
  const supabase = await createClient();
  const { error } = await supabase.from('ugc_slots').update(patch).eq('id', slotId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ugc/${clientId}`);
}

export async function removeUgcSlot(clientId: string, slotId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('ugc_slots').delete().eq('id', slotId).eq('client_id', clientId);
  if (error) throw new Error(error.message);
  revalidatePath(`/ugc/${clientId}`);
}
