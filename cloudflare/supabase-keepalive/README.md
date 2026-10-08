# Maua Supabase Keep-Alive Worker

This Worker runs once every 24 hours through a Cloudflare Cron Trigger and makes a harmless read-only request to the Maua Marketplace Supabase REST API.

## Cloudflare setup

Create/deploy this Worker from the `cloudflare/supabase-keepalive` directory.

Add this Worker secret:

- `SUPABASE_ANON_KEY` — the same Supabase browser key already used by Maua Marketplace

The Supabase project URL is already configured in `wrangler.jsonc`.

The Cron Trigger is:

`0 0 * * *`

which runs daily at 00:00 UTC.

Do not put a Supabase secret/service-role key in this Worker. The read-only public key is sufficient for the keep-alive request.

## Test

After deployment, use the Worker dashboard's Cron Trigger test/run option, or Wrangler's scheduled-handler test locally.

The Worker does not write to the database, create rows, modify listings, or affect user accounts.
