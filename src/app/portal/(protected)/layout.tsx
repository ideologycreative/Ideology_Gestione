import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { signOutClient } from '@/lib/sign-out';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) redirect('/portal/login');
  if (profile.kind !== 'client') redirect('/');

  return (
    <div className="app-shell-min" data-theme="dark">
      <header className="app-shell-min-hd">
        <span className="wordmark">PED</span>
        <form action={signOutClient}>
          <button className="rail-link" type="submit">Esci</button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
