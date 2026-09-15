'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SHARED_FIELDS } from '@/lib/platforms';
import type { Database } from '@/lib/supabase/types';

type ItemRow = Database['public']['Tables']['content_items']['Row'];
type ItemPatch = Partial<ItemRow>;

function revalidate(clientId: string) {
  revalidatePath(`/content/${clientId}`);
}

/**
 * Ported from legacy/src/app/core.js's patchItem() — a content edit reaches
 * every channel this post goes out on (SHARED_FIELDS); approval state and
 * client feedback do not. There it rewrote a JSON array and walked every
 * account+kind combination by hand; a real group_id column means "every
 * other row in this group" is just a WHERE clause.
 */
export async function patchItem(clientId: string, itemId: string, patch: ItemPatch) {
  const supabase = await createClient();

  const { data: current } = await supabase.from('content_items').select('group_id').eq('id', itemId).single();
  if (!current) throw new Error('Item not found');

  const { error } = await supabase.from('content_items').update(patch).eq('id', itemId);
  if (error) throw new Error(error.message);

  if (current.group_id) {
    const shared: ItemPatch = {};
    for (const key of SHARED_FIELDS) {
      if (key in patch) (shared as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
    }
    if (Object.keys(shared).length) {
      await supabase.from('content_items').update(shared).eq('group_id', current.group_id).neq('id', itemId);
    }
  }

  revalidate(clientId);
}

export async function createItem(
  clientId: string,
  accountId: string,
  kind: 'feed' | 'story',
  date: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .insert({ client_id: clientId, account_id: accountId, kind, date })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Failed to create item');
  revalidate(clientId);
  return data.id;
}

export async function removeItem(clientId: string, itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('content_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  revalidate(clientId);
}

/** Griglia reorder — sort_order among the same account+kind+month set, matching legacy's per-month array-order scope. */
export async function moveItem(clientId: string, accountId: string, kind: 'feed' | 'story', orderedIds: string[]) {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, i) => supabase.from('content_items').update({ sort_order: i }).eq('id', id))
  );
  revalidate(clientId);
}

type SetTargetsResult =
  | { removedSelf: false }
  | { removedSelf: true; nextId: string | null; nextAccountId: string | null };

/**
 * Ported from legacy/src/app/core.js's setTargets() — add/remove channels
 * for a piece of content. Adding clones the content (SHARED_FIELDS only,
 * approval resets) into that account's feed; removing deletes that
 * channel's copy, including the one currently open (the caller is told
 * where the selection should move).
 */
export async function setTargets(clientId: string, itemId: string, accountIds: string[]): Promise<SetTargetsResult> {
  const supabase = await createClient();

  const { data: item } = await supabase.from('content_items').select('*').eq('id', itemId).single();
  if (!item) throw new Error('Item not found');

  // group_id is NOT NULL DEFAULT gen_random_uuid() in the schema — every
  // row has one from the moment it's created, unlike legacy's JSON items
  // which only grew a groupId the first time a second channel was added.
  const groupId = item.group_id;

  const { data: siblings } = await supabase.from('content_items').select('*').eq('group_id', groupId);
  const current = siblings ?? [];
  const have = current.map((r) => r.account_id);

  const toAdd = accountIds.filter((id) => !have.includes(id));
  if (toAdd.length) {
    const clones = toAdd.map((accountId) => ({
      client_id: clientId,
      account_id: accountId,
      kind: item.kind,
      group_id: groupId,
      type: item.type,
      url: item.url,
      external_url: item.external_url,
      video_url: item.video_url,
      slides: item.slides,
      date: item.date,
      copy: item.copy,
      note: item.note,
      pillar_id: item.pillar_id,
      format_id: item.format_id,
      sponsored: item.sponsored,
      appr_stato: 'bozza' as const,
      appr_revisions: 0,
    }));
    await supabase.from('content_items').insert(clones);
  }

  const toRemove = current.filter((r) => !accountIds.includes(r.account_id));
  let droppedSelf = false;
  if (toRemove.length) {
    droppedSelf = toRemove.some((r) => r.id === itemId);
    await supabase.from('content_items').delete().in('id', toRemove.map((r) => r.id));
  }

  revalidate(clientId);

  if (!droppedSelf) return { removedSelf: false };

  const { data: remaining } = await supabase
    .from('content_items')
    .select('id, account_id')
    .eq('group_id', groupId)
    .limit(1);
  const r = remaining?.[0];
  return { removedSelf: true, nextId: r?.id ?? null, nextAccountId: r?.account_id ?? null };
}

/**
 * Ported from legacy/src/app/core.js's hasStoryLink()/setStoryLink() — the
 * other axis from channel targets: the same content, also on the other
 * SURFACE (feed vs. story) of the SAME account. One companion copy per
 * account, kept in sync via the same group_id.
 */
export async function setStoryLink(clientId: string, itemId: string, on: boolean) {
  const supabase = await createClient();
  const { data: item } = await supabase.from('content_items').select('*').eq('id', itemId).single();
  if (!item) throw new Error('Item not found');

  const groupId = item.group_id;
  const wantKind = item.kind === 'story' ? 'feed' : 'story';
  const { data: existing } = await supabase
    .from('content_items')
    .select('id')
    .eq('group_id', groupId)
    .eq('kind', wantKind)
    .eq('account_id', item.account_id)
    .maybeSingle();

  if (on) {
    if (existing) return;
    await supabase.from('content_items').insert({
      client_id: clientId,
      account_id: item.account_id,
      kind: wantKind,
      group_id: groupId,
      type: item.type,
      url: item.url,
      external_url: item.external_url,
      video_url: item.video_url,
      slides: item.slides,
      date: item.date,
      copy: item.copy,
      note: item.note,
      pillar_id: item.pillar_id,
      format_id: item.format_id,
      sponsored: item.sponsored,
      appr_stato: 'bozza',
      appr_revisions: 0,
    });
  } else if (existing) {
    await supabase.from('content_items').delete().eq('id', existing.id);
  }

  revalidate(clientId);
}
