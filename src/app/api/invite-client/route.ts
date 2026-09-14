import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Studio-only: invites a person to a client's portal account. Called from
 * the Clienti UI once it exists (Phase B) — this route is the plumbing.
 *
 * Body: { email: string, clientId: string, name?: string }
 *
 * Uses the service-role client because `auth.admin.inviteUserByEmail` is a
 * privileged operation with no RLS equivalent — the studio-only check
 * below is what stands in its place, done before the service client is
 * ever touched.
 */
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.kind !== 'studio') {
    return NextResponse.json({ error: 'not authorized' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
  const name = typeof body?.name === 'string' ? body.name : '';

  if (!email || !clientId) {
    return NextResponse.json({ error: 'email and clientId are required' }, { status: 400 });
  }

  const service = createServiceClient();

  // Confirm the client actually exists before minting an invite for it —
  // a typo'd clientId would otherwise create an orphaned profile.
  const { data: client, error: clientError } = await service
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single();
  if (clientError || !client) {
    return NextResponse.json({ error: 'unknown clientId' }, { status: 400 });
  }

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { kind: 'client', client_id: clientId, name },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ userId: data.user?.id });
}
