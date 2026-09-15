import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/components/PageFrame';
import { SettingsForm } from '@/components/SettingsForm';

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data: userRes }, { data: setting }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('settings').select('value').eq('key', 'studioLogo').maybeSingle(),
  ]);

  const { data: profile } = await supabase.from('profiles').select('name').eq('user_id', userRes.user!.id).single();
  const logoUrl = (setting?.value as { url?: string } | null)?.url ?? '';

  return (
    <PageFrame>
      <div className="page">
        <div className="page-hd">
          <div>
            <h1 className="page-title">Impostazioni</h1>
            <p className="page-sub">Dati dello studio</p>
          </div>
        </div>
        <SettingsForm logoUrl={logoUrl} email={userRes.user!.email!} name={profile?.name ?? ''} />
      </div>
    </PageFrame>
  );
}
