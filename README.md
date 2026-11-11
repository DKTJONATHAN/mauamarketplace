# Maua Marketplace

A free classifieds site for Maua, Meru County. People post items, produce, services and property, and talk to each other
inside the app. The site never handles money and never verifies anyone, so it ships with safety tools built in.

- React 19 + TypeScript + Vite, deployed to Cloudflare Pages
- Supabase for accounts (email and Google), listings, messages and Row Level Security
- Google Identity Services provides the branded Google sign-in button and returns an ID token directly to Supabase Auth. This avoids the Supabase-hosted browser redirect while retaining Supabase sessions.
- Listing photos are stored in Cloudflare R2; uploads are handled by a Cloudflare Pages Function. Supabase remains the database/auth backend.
- See `specs/marketplace_design.md` for the design decisions

## What members get

- Sign up with email or Google. Email is never shown publicly. Google names are not imported, so nobody is named without choosing it.
- About 50 categories (phones, TVs, laptops, clothes, school items, cars, house helps, farm produce, livestock, property, services and more)
- Search, price, condition, place and sort filters; save listings; listings remain live until the seller marks them sold or they are removed
- In-app chat with live updates, so nobody has to share a phone number. Optional phone number per listing, visible only to signed-in members who accept a safety reminder
- Caution features: safety panel on every listing with category-specific advice (IMEI checks, logbook and NTSA search, land search, house-help checks), scam warnings under chat messages, report listing/member, block member, "new member" badge, automatic hiding after five reports, daily posting and messaging limits, 18+ confirmation for house-help and jobs, photo location data stripped before upload, account deletion that also removes photos

## One-time setup

You need a Supabase project (free tier is fine) and this repository to be public.

### 1. Configure Google sign-in

Google sign-in uses Google's popup credential flow and Supabase's `signInWithIdToken()` API. Supabase remains responsible for validating the Google ID token and issuing the normal app session.

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the project that owns your OAuth client.
2. Under **Branding**, set the app name to **Maua Marketplace**, upload the Maua Marketplace logo, and confirm the authorised domain and homepage.
3. Under **Clients**, create or use an OAuth client with application type **Web application**.
4. Under **Authorized JavaScript origins**, add every origin where the app is served, for example:
   - `https://mauamarketplace.eu.cc`
   - `https://mauamarketplace.pages.dev` (if you still use this address)
   - `http://localhost:5173` (local development only)
5. Copy the OAuth **Client ID**. Do not put the client secret in the browser.
6. Keep Google enabled under **Supabase Dashboard > Authentication > Sign In / Providers > Google** and configure the same Google Client ID and its client secret there. Supabase validates the ID token and creates the existing Supabase user session.
7. Add `VITE_GOOGLE_CLIENT_ID` to the Cloudflare Pages project's **Production** and **Preview** environment variables, using the Web client ID from step 5. Redeploy after saving it.

   **Important:** `VITE_GOOGLE_CLIENT_ID` is a Vite build-time variable. It must be present in the Pages **Build configurations > Environment variables** for the Production environment before the build starts; adding it only as a runtime Worker/Pages Function variable does not expose it to the browser bundle. After changing it, trigger a new Production deployment from the `main` branch. In the deployed browser bundle, the Google Identity Services script (`https://accounts.google.com/gsi/client`) should be requested; if the app immediately shows the unavailable message and that script is never requested, the production build did not receive a usable client ID.

This popup-based ID-token flow does not send the browser through `<project-ref>.supabase.co/auth/v1/authorize` or require that Supabase URL as a Google redirect URI. Google still verifies the user's identity, and Supabase Auth remains the session and account provider. Keep your Supabase Google provider enabled.

For local development, add the same variable to `.env.local`. See `.env.example`.

### 2. Configure the Supabase project

1. Create a project. Note the **Project URL**, the **anon (publishable) key**, the **project ref** (the part before `.supabase.co`) and the **database password**.
2. Authentication > URL Configuration:
   - Site URL: your Cloudflare Pages URL or custom domain, e.g. `https://mauamarketplace.eu.cc/`
   - Redirect URLs: add the same URL, and `http://localhost:5173/` for local work.
3. Authentication > Sign In / Providers > Email: keep **Confirm email** on. (Photo uploads require a confirmed email, which blocks throw-away sign-ups.)
4. Authentication > Sign In / Providers > Google: enable it. Keep the Google Client ID and client secret configured as described above. The old callback URL may remain registered for compatibility, but this app's new Google button uses the popup ID-token flow.
5. Supabase's built-in email sender is limited to a few messages per hour. Before real launch, add your own SMTP provider under Authentication > SMTP Settings, otherwise sign-up emails will stall.

### 3. Configure Cloudflare Pages environment variables

In Cloudflare Pages, open the project and set these variables for the Production environment:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon / publishable key |
| `VITE_GOOGLE_CLIENT_ID` | your Google OAuth Web client ID |
| `VITE_R2_MEDIA_BASE_URL` | the public base URL of the R2 media domain, with no trailing slash |

The app is configured to use `/` as its permanent base path. Build with `npm run build`; the output directory is `dist`.

Cloudflare Pages should deploy from the `main` branch using the project’s Git integration. GitHub is used only as the source repository; Cloudflare Pages is the hosting and deployment platform.

### 4. Deploy

1. Connect `DKTJONATHAN/mauamarketplace` to Cloudflare Pages.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Add the four `VITE_` variables above.
4. Bind the R2 bucket to the Pages project using the binding name `MEDIA` (Settings > Bindings > Add > R2 bucket), then redeploy.

Your site is then live at your Cloudflare Pages URL or custom domain. New photos go to R2 while the migration is in progress, and old Supabase Storage photos continue to work until they are migrated.

The browser only needs the Supabase `VITE_` values, Google client ID, and `VITE_R2_MEDIA_BASE_URL`. The Pages Function keeps the Supabase service credential server-side.

## Local development

```sh
cp .env.example .env.local   # fill in the Supabase values and Google Web client ID
npm install
npm run dev                  # http://localhost:5173
npm test && npm run build
```

## Things to know

- **Custom domain:** set the function secret `ALLOWED_ORIGINS` to your domain (comma-separated list).
- **Moderating:** reported listings hide themselves at five reports. To remove anything yourself, use the Supabase dashboard (Table editor > `listings`, set `status` to `hidden`, or delete the row). Only the database owner can unhide a listing.
- **Photo storage:** photos are resized to at most 1280px and compressed, typically 100 to 400 KB each, then stored in R2. Deleted photos are removed from R2. Existing Supabase Storage photos can be migrated in small batches without recreating accounts or listings.
- **Rules and privacy text:** `src/pages/RulesPage.tsx` and `SafetyPage.tsx` are drafts written for this build. Have a Kenyan lawyer review them, and check whether you need to register with the Office of the Data Protection Commissioner. Set `contactEmail` in `src/config/site.ts` so people can request removals.
- **Launching Meru later:** copy the project, change `src/config/site.ts` (place and locations) and deploy it against its own Supabase project.
- **Link previews:** because the site is a static single-page app, WhatsApp shows the same preview for every listing link.

### 5. Cloudflare R2 media setup

Create an R2 bucket, for example `maua-marketplace-media`. In the Pages project, bind it as an R2 bucket with the variable name **MEDIA**.

Add these Production variables/secrets to the Pages project:

| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Variable | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Variable | Your Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Your Supabase server-side service role/secret key |
| `MEDIA_MIGRATION_SECRET` | **Secret** | A long random value used only for the one-time migration |
| `VITE_R2_MEDIA_BASE_URL` | Variable | Your R2 public custom-domain URL, without a trailing slash |

For production, connect a custom domain to the R2 bucket rather than using the `r2.dev` development URL.

After saving the binding and variables, trigger a new Pages deployment. The browser uploads to `/api/media`; the Pages Function validates the signed-in Supabase user and writes the photo to R2. Supabase Auth and all existing database records remain unchanged.

### 6. Migrate existing Supabase Storage photos

**Do not** delete the existing Supabase Storage bucket yet. The migration is deliberately dual-read: old paths continue loading from Supabase while migrated paths use R2.

After the new deployment is live, run the migration endpoint in batches of up to 25:

```sh
curl -X POST "https://mauamarketplace.pages.dev/api/media?action=migrate&limit=25" \
  -H "x-media-migration-secret: YOUR_MEDIA_MIGRATION_SECRET"
```

Repeat until the response reports `migrated: 0`. Verify the listings and their images in the website before removing the old Supabase Storage objects.


## Account reference

Maua Marketplace's connected Supabase project is managed through the **Mauamarket** Supabase account.

- **Supabase account email:** `hojo.m3@ggmail.com`
- **Project reference:** `akrbmcptyjjcjoyxaxkl`
- **Project URL:** `https://akrbmcptyjjcjoyxaxkl.supabase.co`

This is a reminder of the account associated with the project. Do not store passwords, API keys, database passwords, or service-role secrets in this README.
