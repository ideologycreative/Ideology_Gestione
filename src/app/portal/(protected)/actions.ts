'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * The only two writes a client session can make — both go through
 * SECURITY DEFINER RPCs (approve_content_item/request_revision in
 * supabase/migrations/20260911120000_initial_schema.sql), never a direct
 * table update. Ported 1:1 from legacy client portal's approve()/
 * sendRevision(): same two state transitions, same fields touched.
 */
export async function approveItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_content_item', { p_item_id: itemId });
  if (error) throw new Error(error.message);
  revalidatePath('/portal');
}

export async function requestRevision(itemId: string, note: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_revision', { p_item_id: itemId, p_note: note });
  if (error) throw new Error(error.message);
  revalidatePath('/portal');
}
