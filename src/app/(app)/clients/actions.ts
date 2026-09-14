'use server';

import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/** Ported from legacy/src/app/core.js's App.createClient() — same defaults, minted then immediately opened for editing. */
export async function createNewClient() {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: 'Nuovo cliente',
      slug: `cliente-${randomSuffix()}`,
      color: '#5B50E6',
      theme: 'dark',
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create client');
  redirect(`/clients/${data.id}`);
}
