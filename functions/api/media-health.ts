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
  let supabaseApiStatus: number | null = null;
  let supabaseApiError: string | null = null;

  if (checks.supabaseUrl && checks.supabaseServerKey) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/uploads?select=path&limit=1`, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Accept: 'application/json',
        },
      });

      supabaseApiStatus = res.status;
      supabaseApi = res.ok;

      if (!res.ok) {
        const raw = await res.text();
        try {
          const parsed = JSON.parse(raw) as { message?: string; hint?: string; code?: string; details?: string };
          supabaseApiError = [parsed.code, parsed.message, parsed.details, parsed.hint]
            .filter(Boolean)
            .join(' | ')
            .slice(0, 500);
        } catch {
          supabaseApiError = raw.slice(0, 500);
        }
      }
    } catch (error) {
      supabaseApiError = error instanceof Error ? error.message.slice(0, 300) : 'Request failed';
    }
  }

  return Response.json({
    ok: checks.r2Binding && checks.supabaseUrl && checks.supabaseAnonKey && checks.supabaseServerKey && supabaseApi,
    checks,
    supabaseApi,
    supabaseApiStatus,
    supabaseApiError,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
};
