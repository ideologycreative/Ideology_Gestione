-- The client portal's masthead reads the studio's logo (settings.key =
-- 'studioLogo'), same as legacy's cv-root masthead did via S.getSetting().
-- The existing settings_studio_all policy gates SELECT too (it's a `for
-- all`), so a kind='client' session got zero rows. settings holds only
-- org-wide, non-sensitive config (currently just the logo URL) — safe for
-- any authenticated user, studio or client, to read.
create policy settings_authenticated_select on settings for select
  using (auth.uid() is not null);
