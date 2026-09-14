import { signInStudio } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="auth-wrap">
      <form className="auth-card" action={signInStudio}>
        <div className="mark" aria-hidden="true">Id</div>
        <h1 className="auth-title">Ideology Studio</h1>
        <p className="auth-sub">Accesso team</p>

        {error && <p className="auth-error">{error}</p>}

        <input type="hidden" name="next" value={next || '/'} />

        <label className="f">
          <span className="f-label">Email</span>
          <input className="input" type="email" name="email" required autoComplete="email" />
        </label>
        <label className="f">
          <span className="f-label">Password</span>
          <input className="input" type="password" name="password" required autoComplete="current-password" />
        </label>

        <button className="btn btn--primary auth-submit" type="submit">Accedi</button>

        <a className="auth-portal-link" href="/portal/login">Sei un cliente? Accedi al portale →</a>
      </form>
    </div>
  );
}
