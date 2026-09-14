import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Runs on every request (Next.js 15's "middleware" file, renamed "proxy" in
 * Next.js 16 — see https://nextjs.org/docs/messages/middleware-to-proxy).
 * Two jobs, both coarse — the fine-grained "is this a studio or a client
 * session" check happens in each area's layout
 * (src/app/(app)/layout.tsx / src/app/portal/(protected)/layout.tsx) via a
 * real `profiles` lookup, not here, so this stays a cheap per-request
 * refresh:
 *
 *   1. Refresh the Supabase session cookie (required by @supabase/ssr —
 *      without this, sessions silently expire mid-visit).
 *   2. Redirect signed-out visitors to the right login screen for the area
 *      of the app they're trying to reach.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPortalArea = path.startsWith('/portal');
  const isLoginPage = path === '/login' || path === '/portal/login';

  if (!user && !isLoginPage) {
    const loginPath = isPortalArea ? '/portal/login' : '/login';
    const url = request.nextUrl.clone();
    url.pathname = loginPath;
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Every request except static assets and Next's own internals — a
     * signed-out visitor hitting any real page should hit the redirect
     * above, not a broken data fetch three components deep.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
