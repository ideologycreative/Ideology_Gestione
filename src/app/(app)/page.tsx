import { createClient } from '@/lib/supabase/server';

export default async function StudioHomePage() {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, tipo, active')
    .order('name');

  return (
    <div>
      <h1 className="page-title">Home</h1>
      <p className="page-sub">Phase A — foundation check</p>

      {error && (
        <p className="auth-error" style={{ marginTop: 16 }}>
          {error.message}
        </p>
      )}

      {!error && (
        <>
          <p style={{ marginTop: 16 }}>
            Signed in as studio. {clients?.length ?? 0} client(s) in the database.
          </p>
          <ul style={{ marginTop: 12 }}>
            {clients?.map((c) => (
              <li key={c.id}>
                {c.name} — {c.tipo} — {c.active ? 'attivo' : 'inattivo'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
