# Background message notifications

Maua Marketplace uses standards-based Web Push, so a device can receive message notifications while the website is in the background or closed. No database schema, trigger, or Supabase setting needs to be changed. The existing Pages API uses the current Supabase auth token to identify the sender and reads the conversation/message to validate the request.

## One-time Cloudflare setup

The app code is committed, but background push cannot work until these Cloudflare bindings and VAPID keys are configured.

### 1. Create a KV namespace

In Cloudflare Dashboard, open **Workers & Pages → KV → Create namespace** and name it `maua-push-subscriptions`.

Open **Workers & Pages → mauamarketplace → Settings → Functions → KV namespace bindings** and add:

- **Variable name:** `PUSH_SUBSCRIPTIONS`
- **KV namespace:** `maua-push-subscriptions`

Add the binding to both **Production** and **Preview** if you test on preview deployments.

### 2. Generate VAPID keys

Run this with Node.js 20+ on your computer (it creates keys locally; never send the private key to anyone):

```js
// Save as generate-vapid.mjs, then run: node generate-vapid.mjs
import { webcrypto } from 'node:crypto';

const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const privateJwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const publicJwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
const decode = (s) => Buffer.from(s, 'base64url');
const publicBytes = Buffer.concat([
  Buffer.from([4]),
  decode(publicJwk.x),
  decode(publicJwk.y),
]);
console.log('VAPID_PUBLIC_KEY=' + publicBytes.toString('base64url'));
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(privateJwk));
```

Keep the generated values private where applicable. The public key is designed to be visible to browsers; **VAPID_PRIVATE_JWK must remain secret**. Do not commit either generated value into GitHub.

### 3. Add Cloudflare variables and secrets

Under **Workers & Pages → mauamarketplace → Settings → Variables and Secrets**, add these to the Pages project:

- `VAPID_PUBLIC_KEY` — the public key printed by the script (regular variable).
- `VAPID_PRIVATE_JWK` — the complete JSON value printed by the script (mark as a secret).
- `VAPID_SUBJECT` — a contact URI such as `mailto:YOUR-REAL-CONTACT-EMAIL` (use an email address you control).

The push endpoint also uses the existing Pages bindings `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` used by the app's current media API. If any of those are missing in the Pages project, configure them as appropriate; never expose the service-role key in browser code.

Save the settings and trigger a new production deployment.

## Test

1. Open the deployed site in Chrome on each device, sign in, and tap the bell icon.
2. Allow notifications when prompted. The app should show **Notifications enabled**. Repeat on every device that should receive notifications.
3. On device A, send a new chat message to device B's account.
4. Device B should receive a notification even when the site is in the background or closed. Tapping it should open that conversation.

Browser/OS notification permissions must be allowed. Some mobile browsers require installing the site as a PWA; on iPhone/iPad, Web Push requires an installed web app on supported iOS versions. The device must have internet access.

## Security and behavior

- Subscriptions are stored in Cloudflare KV, keyed by authenticated user ID.
- The API verifies the caller's Supabase session and confirms the caller is a participant in the conversation. It checks that the latest message was sent by that caller before sending a push.
- No message body is included in the notification; it only names the listing to avoid exposing private chat content on a locked screen.
- Supabase schema, policies, triggers, and settings are not changed.
