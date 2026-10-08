export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  TEST_SECRET?: string;
}

const PING_PATH = "/rest/v1/listings?select=id&limit=1";

async function pingSupabase(env: Env): Promise<{ status: number; body: string }> {
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}${PING_PATH}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase keep-alive failed: HTTP ${response.status} ${body.slice(0, 300)}`,
    );
  }

  return { status: response.status, body };
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    const result = await pingSupabase(env);

    console.log(
      JSON.stringify({
        ok: true,
        type: "scheduled",
        cron: controller.cron,
        status: result.status,
        timestamp: new Date().toISOString(),
      }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/test") {
      return new Response("Maua Supabase keep-alive is running.", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    try {
      const result = await pingSupabase(env);

      return Response.json({
        ok: true,
        message: "Supabase keep-alive test succeeded.",
        supabaseStatus: result.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 },
      );
    }
  },
};
