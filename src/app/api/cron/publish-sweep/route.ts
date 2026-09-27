import { NextResponse } from 'next/server';
import { runPublishSweep } from '@/lib/publish-sweep';

/**
 * A standalone entry point for the same sweep the studio/portal layouts
 * already run on every page load — not load-bearing today (interactive
 * traffic keeps due jobs moving), but this is where a real Vercel Cron
 * (or any external scheduler) plugs in later for reliable execution when
 * no one has a tab open, without changing anything about the sweep itself.
 * Guarded by CRON_SECRET so it can't be triggered by an outsider.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'not authorized' }, { status: 401 });
  }

  await runPublishSweep();
  return NextResponse.json({ ok: true });
}
