# Maua Marketplace

**Free local classifieds for Maua, Meru County.**

Buy and sell phones, farm produce, furniture, cars, livestock, property, services and more — right where you live. Listings stay up until the seller marks them sold. Chat happens inside the app so you never have to share a phone number unless you want to.

The platform never holds money, never verifies sellers, and never inspects items. Safety tools are built in from the start.

---

## What you can do

- **Post a listing** in ~50 categories (phones, TVs & audio, computers, furniture, clothing, school items, cars, farm produce, livestock, property for rent/sale, house help, services, and more)
- **Search & filter** by category, price, condition, location and sort order
- **Save favourites** and message sellers with live chat
- **Optional phone number** on a listing — shown only to signed-in members who accept a safety reminder
- **Report or block** anything that feels off; listings auto-hide after five reports

### Safety built in

- Category-specific tips on every listing (IMEI checks, NTSA/logbook, land search, house-help checks, etc.)
- Scam warnings under chat messages
- “New member” badge for recent accounts
- Daily posting and messaging limits
- 18+ confirmation for house-help and job listings
- Photo location data stripped before upload
- Full account deletion also removes your photos

---

## Mobile-first experience

The UI is tuned for phones:

- Compact header with logo + wordmark and a single-row category rail
- Icon shortcuts for popular categories on the home page
- Sticky **Message / Phone / Save** action bar on listing pages
- Swipeable photo gallery with a photo counter
- Compact safety panel that leads with category advice

An Android APK is available from the [latest release](https://github.com/DKTJONATHAN/mauamarketplace/releases/latest).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript + Vite |
| Hosting | Cloudflare Pages |
| Auth & database | Supabase (email + Google, RLS) |
| Listing photos | Cloudflare R2 (via Pages Function) |
| Chat | Real-time via Supabase |

Design notes live in `specs/marketplace_design.md`.

---

## Local development

```bash
cp .env.example .env.local   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
npm test && npm run build
```

---

## Deploy (Cloudflare Pages + Supabase + R2)

1. **Supabase** – create a project, enable Email (confirm email on) and Google providers, set Site URL + Redirect URLs to your Pages domain (and `http://localhost:5173` for local work).
2. **Cloudflare Pages** – connect this repo, build command `npm run build`, output directory `dist`.
3. **Environment variables** (Production):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon/publishable key |
   | `VITE_R2_MEDIA_BASE_URL` | public base URL of the R2 media domain (no trailing slash) |

4. **R2** – create a bucket, bind it to the Pages project as `MEDIA`. Add server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc.) for the media Function.
5. Redeploy. New photos go to R2; existing Supabase Storage paths continue to work until migrated.

See `specs/` for media-migration and SMTP details.

---

## Licence & contact

This is a community project for Maua. Rules and privacy text in the app are drafts — have a Kenyan lawyer review them before wide launch, and check Data Protection Commissioner registration if required.

Set `contactEmail` in `src/config/site.ts` so people can request removals.
