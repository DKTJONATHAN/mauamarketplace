export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const PING_PATH = "/rest/v1/listings?select=id&limit=1";

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const url = `${env.SUPABASE_URL.replace(/\/$/, "")}${PING_PATH}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Supabase keep-alive failed: HTTP ${response.status} ${body.slice(0, 300)}`,
      );
    }

    console.log(
      JSON.stringify({
        ok: true,
        cron: controller.cron,
        status: response.status,
        timestamp: new Date().toISOString(),
      }),
    );

    ctx.waitUntil(Promise.resolve());
  },
};
