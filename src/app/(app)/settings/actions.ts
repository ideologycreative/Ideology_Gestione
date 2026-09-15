'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setStudioLogo(logoUrl: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('settings').upsert({ key: 'studioLogo', value: { url: logoUrl } });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
