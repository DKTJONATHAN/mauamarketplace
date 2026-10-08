# Maua Marketplace

A free classifieds site for Maua, Meru County. People post items, produce, services and property, and talk to each other
inside the app. The site never handles money and never verifies anyone, so it ships with safety tools built in.

- React 19 + TypeScript + Vite, deployed to Cloudflare Pages
- Supabase for accounts (email and Google), listings, messages and Row Level Security
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

### 1. Apply the patch

```bash
git clone https://github.com/DKTJONATHAN/mauamarketplace.git
cd mauamarketplace
git rm -f README.md .gitignore 2>/dev/null; git commit -m "Clear starter files" 2>/dev/null   # only if GitHub created them
git am < maua-marketplace.patch
git push origin main
```

No local machine? Open the repository in a Codespace (Code > Codespaces), upload `maua-marketplace.patch` into it, and run the same `git am` and `git push` commands in its terminal.

### 2. Configure the Supabase project

Supabase stores accounts, listings, messages and other application data. Listing photos are stored in Cloudflare R2, not Supabase Storage.

### 3. Set up Supabase

1. Create a project. Note the **Project URL**, the **anon (publishable) key**, the **project ref** (the part before `.supabase.co`) and the **database password**.
2. Authentication > URL Configuration:
   - Site URL: your Cloudflare Pages URL or custom domain, e.g. `https://mauamarketplace.pages.dev/`
   - Redirect URLs: add the same URL, and `http://localhost:5173/` for local work.
3. Authentication > Sign In / Providers > Email: keep **Confirm email** on. (Photo uploads require a confirmed email, which blocks throw-away sign-ups.)
4. Authentication > Sign In / Providers > Google: enable it. In Google Cloud Console create an OAuth client of type *Web application*, add `https://YOUR-REF.supabase.co/auth/v1/callback` as an authorised redirect URI and your Cloudflare Pages/custom-domain origin as an authorised JavaScript origin, then paste the client ID and secret into Supabase.
5. Supabase's built-in email sender is limited to a few messages per hour. Before real launch, add your own SMTP provider under Authentication > SMTP Settings, otherwise sign-up emails will stall.

### 4. Configure Cloudflare Pages environment variables

In Cloudflare Pages, open the project and set these variables for the Production environment:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon / publishable key |
| `VITE_R2_MEDIA_BASE_URL` | the public base URL of the R2 media domain, with no trailing slash |

The app is configured to use `/` as its permanent base path. Build with `npm run build`; the output directory is `dist`.

Cloudflare Pages should deploy from the `main` branch using the project’s Git integration. GitHub is used only as the source repository; Cloudflare Pages is the hosting and deployment platform.

### 5. Deploy

1. Connect `DKTJONATHAN/mauamarketplace` to Cloudflare Pages.
2. Set the build command to `npm run build` and the output directory to `dist`.
3. Add the two `VITE_` variables above.
4. Bind the R2 bucket to the Pages project using the binding name `MEDIA` (Settings > Bindings > Add > R2 bucket), then redeploy.

Your site is then live at your Cloudflare Pages URL or custom domain. New photos go to R2 while the migration is in progress, and old Supabase Storage photos continue to work until they are migrated.

The browser only needs the two Supabase `VITE_` values plus `VITE_R2_MEDIA_BASE_URL`. The Pages Function keeps the Supabase service credential server-side.

## Local development

```bash
cp .env.example .env.local   # fill in the two Supabase values
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
