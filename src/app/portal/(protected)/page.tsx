import { createClient } from '@/lib/supabase/server';

export default async function PortalHomePage() {
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from('clients')
    .select('name, color')
    .single();

  return (
    <div>
      <h1 className="page-title">Piano editoriale</h1>
      <p className="page-sub">Phase A — foundation check</p>

      {error && (
        <p className="auth-error" style={{ marginTop: 16 }}>
          {error.message}
        </p>
      )}
      {client && (
        <p style={{ marginTop: 16 }}>
          Signed in for <strong>{client.name}</strong> — Row-Level Security scoped this
          query to exactly one client row, with no token in the URL.
        </p>
      )}
    </div>
  );
}
