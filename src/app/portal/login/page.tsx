import { signInClient } from './actions';

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="auth-wrap" data-theme="dark">
      <form className="auth-card" action={signInClient}>
        <div className="mark" aria-hidden="true">Id</div>
        <h1 className="auth-title">Piano editoriale</h1>
        <p className="auth-sub">Accesso cliente</p>

        {error && <p className="auth-error">{error}</p>}

        <input type="hidden" name="next" value={next || '/portal'} />

        <label className="f">
          <span className="f-label">Email</span>
          <input className="input" type="email" name="email" required autoComplete="email" />
        </label>
        <label className="f">
          <span className="f-label">Password</span>
          <input className="input" type="password" name="password" required autoComplete="current-password" />
        </label>

        <button className="btn btn--primary auth-submit" type="submit">Accedi</button>
      </form>
    </div>
  );
}
