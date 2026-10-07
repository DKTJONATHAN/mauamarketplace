export function SetupNeeded() {
  return (
    <div className="wrap page narrow">
      <h1>Connect Supabase to finish setup</h1>
      <p>
        This build has no Supabase connection. In the GitHub repository, open Settings, then Secrets and variables, then
        Actions, then the Variables tab, and add two repository variables:
      </p>
      <ul>
        <li>
          <code>VITE_SUPABASE_URL</code> - your project URL
        </li>
        <li>
          <code>VITE_SUPABASE_ANON_KEY</code> - your anon (publishable) key
        </li>
      </ul>
      <p>Then re-run the "Deploy site" workflow. The README has the full checklist.</p>
    </div>
  );
}
