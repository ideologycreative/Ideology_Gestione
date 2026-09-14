import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signOutStudio } from '@/lib/sign-out';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  // No profile at all means the trigger hasn't run yet or something is
  // wrong server-side — treat it the same as signed-out rather than
  // showing a broken page.
  if (!profile) redirect('/login');

  // A client account wandering onto the studio URLs gets sent to their
  // own portal, not a permission-denied page.
  if (profile.kind !== 'studio') redirect('/portal');

  return (
    <div className="app-shell-min">
      <header className="app-shell-min-hd">
        <span className="wordmark">IDEOLOGY STUDIO</span>
        <form action={signOutStudio}>
          <button className="rail-link" type="submit">Esci</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
