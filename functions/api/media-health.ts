interface Env {
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MEDIA_MIGRATION_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const checks = {
    r2Binding: Boolean(env.MEDIA),
    supabaseUrl: Boolean(env.SUPABASE_URL),
    supabaseAnonKey: Boolean(env.SUPABASE_ANON_KEY),
    supabaseServerKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    migrationSecret: Boolean(env.MEDIA_MIGRATION_SECRET),
  };

  let supabaseApi = false;
  if (checks.supabaseUrl && checks.supabaseServerKey) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/uploads?select=path&limit=1`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
      });
      supabaseApi = res.ok;
    } catch {
      supabaseApi = false;
    }
  }

  return Response.json({
    ok: checks.r2Binding && checks.supabaseUrl && checks.supabaseAnonKey && checks.supabaseServerKey && supabaseApi,
    checks,
    supabaseApi,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
};
