import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * The service-role client — bypasses RLS entirely. `import 'server-only'`
 * makes any accidental import from client code a build error, not just a
 * lint warning. Use ONLY for: the client-invite route, the Meta OAuth
 * callback (Phase E), and the cron publish-sweep route. Never construct
 * this from a value that reaches the browser.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
