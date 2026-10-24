# Background message notifications (Cloudflare Pages)

The app now requests a background push after a message is successfully sent. The existing `functions/api/push.ts` endpoint validates the signed-in sender, checks that they participate in the conversation, and sends encrypted Web Push to the other participant's saved devices. It does not require database schema changes or Supabase dashboard changes.

## One-time Cloudflare setup

These steps are required before background push can work. They are Cloudflare Pages settings, not Supabase changes.

1. Open **Cloudflare Dashboard → Workers & Pages → mauamarketplace → Settings → Bindings**.
2. Add a **KV namespace** binding named exactly `PUSH_SUBSCRIPTIONS`. Create a namespace such as `maua-push-subscriptions` and bind it to the production Pages project. Add the same binding to Preview only if you want notifications on preview deployments.
3. Under **Settings → Variables and Secrets**, configure these for Production:
   - Variable `SUPABASE_URL`: `https://akrbmcptyjjcjoyxaxkl.supabase.co`
   - Variable `SUPABASE_ANON_KEY`: the existing public/anon key already used by the app
   - Secret `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key for this project. Keep it only in Cloudflare secrets; never commit it or expose it in a `VITE_*` variable.
   - Variable `VAPID_PUBLIC_KEY`: generated in the next section
   - Secret `VAPID_PRIVATE_JWK`: the full JSON string generated in the next section
   - Variable `VAPID_SUBJECT`: `mailto:info@jonathanmwaniki.co.ke`
4. Save settings and trigger a new production deployment so the Pages Function receives the binding and variables.

The service-role key is used only server-side to confirm the latest message and conversation participants. Do not share it in chat or commit it to GitHub.

## Generate VAPID keys

From the repository root on a computer with Node.js installed, run:

```sh
node scripts/generate-vapid-keys.mjs
```

Copy `VAPID_PUBLIC_KEY` into the matching Cloudflare **Variable** and the complete `VAPID_PRIVATE_JWK` JSON string into the matching Cloudflare **Secret**. They must come from the same generated key pair. Generate these once and keep them stable; do not regenerate them after users have subscribed, or devices will need to subscribe again. Never commit the output.

## Test

1. Deploy the production site and open `https://mauamarketplace.pages.dev` in Chrome on the receiving phone.
2. Sign in with the recipient's account. Tap the bell icon and allow notifications. It should show a local “Notifications enabled” confirmation.
3. Repeat on each device that should receive alerts. The browser must permit notifications; on Android, Chrome may need to be installed/allowed and battery/background restrictions can affect delivery.
4. From another account/device, send a new message in a conversation with that recipient.
5. The sender's browser calls `POST /api/push`; the Pages Function sends Web Push to all saved recipient subscriptions. Tap the notification to open the conversation.

## Important limitations

- The recipient must enable notifications on each browser/device at least once while signed in.
- Browser push can be delayed by the operating system, browser settings, battery saver, or push service.
- The code sends push after a message is sent, so it does not depend on the recipient's browser having an open Supabase Realtime connection.
- No Supabase tables, policies, triggers, functions, or dashboard settings are changed by this feature.
