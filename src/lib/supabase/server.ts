import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/supabase/types';

/**
 * The server client — for Server Components, Server Actions and Route
 * Handlers. Also runs under the signed-in user's session (cookie-based),
 * so RLS still applies; this is NOT the service-role client.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (not an Action/Route Handler) —
            // the middleware below refreshes the session on every request,
            // so a failed write here is harmless.
          }
        },
      },
    }
  );
}
