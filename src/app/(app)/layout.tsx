import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { getMetaRailStatus } from '@/lib/rail-meta';
import { RailNav } from '@/components/RailNav';
import { InspectorProvider } from '@/components/InspectorContext';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // No profile at all means the trigger hasn't run yet or something is
  // wrong server-side — treat it the same as signed-out rather than
  // showing a broken page.
  if (!profile) redirect('/login');

  // A client account wandering onto the studio URLs gets sent to their
  // own portal, not a permission-denied page.
  if (profile.kind !== 'studio') redirect('/portal');

  const meta = await getMetaRailStatus();

  return (
    <InspectorProvider>
      <div className="app">
        <RailNav meta={meta} />
        {children}
      </div>
    </InspectorProvider>
  );
}
