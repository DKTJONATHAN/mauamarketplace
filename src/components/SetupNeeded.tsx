export function SetupNeeded() {
  return (
    <div className="wrap page narrow">
      <h1>Connect Supabase to finish setup</h1>
      <p>
        This build was made without a Supabase connection. Add these two build variables where the site is built (Cloudflare,
        or the GitHub repository variables if you deploy with GitHub Pages), then build and deploy again:
      </p>
      <ul>
        <li>
          <code>VITE_SUPABASE_URL</code> - your project URL
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code> - your anon (publishable) key
        </li>
      </ul>
      <p>The values are read at build time, so a rebuild is needed after changing them. The README has the full checklist.</p>
    </div>
  );
}
