import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * The signed-in user's profile row (kind + client_id), or null if there's
 * no session or the trigger hasn't created a profile yet. Every area
 * layout (studio / portal) uses this — one query, one place — rather than
 * each page re-deriving "am I allowed here" its own way.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return profile ?? null;
}
