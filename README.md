# Maua Marketplace

**Maua Marketplace** (also known as **Maua Soko**) is a community classifieds marketplace for Maua town, Meru County, Kenya. It helps people discover local goods, farm produce, property and services, publish listings, and contact sellers through in-app messaging.

**Live website:** https://mauamarketplace.eu.cc

Maua Marketplace is a peer-to-peer listing and discovery platform. It does not process payments, hold money, provide escrow, or independently verify sellers, buyers, listings, or products. Members should inspect items and use the safety guidance before making arrangements.

## Features

- **Browse without an account:** visitors can explore published listings.
- **Member accounts:** email/password registration and Google sign-in.
- **Local listings:** products, second-hand goods, farm produce, livestock, property, jobs, household help and services.
- **Search and discovery:** category, location, price, condition and sorting filters.
- **Saved listings:** members can keep track of listings they are interested in.
- **In-app conversations:** members can contact sellers without publishing their phone numbers; chat supports live updates and image attachments.
- **Optional seller phone number:** shown only to signed-in members after a safety reminder.
- **Marketplace safety tools:** listing-specific advice, scam warnings in chat, listing/member reports, member blocking, new-member indicators and automatic hiding after the report threshold.
- **Abuse controls:** posting and messaging limits, plus age confirmations for applicable jobs and household-help categories.
- **Privacy-conscious image handling:** listing photos are prepared before upload, including removal of image location metadata.
- **Account and listing cleanup:** supported deletion flows remove associated media where applicable.

The marketplace is designed for local discovery and communication—not as a payment intermediary or identity-verification service.

## Technology

| Area | Technology |
|---|---|
| Front end | React 19, TypeScript, Vite |
| Routing and data fetching | React Router, TanStack Query |
| UI icons | Lucide React |
| Authentication and application data | Supabase Auth and PostgreSQL |
| Access control | Supabase Row Level Security (RLS) |
| Live messaging | Supabase Realtime |
| Google sign-in | Google Identity Services ID-token flow with Supabase Auth |
| Image storage | Cloudflare R2 |
| Server-side media endpoints | Cloudflare Pages Functions |
| Hosting and deployment | Cloudflare Pages, connected to GitHub |

GitHub is the source repository. **The production website is hosted on Cloudflare Pages**, not GitHub Pages.

## How the application is configured

### Google sign-in

The app uses Google's official Identity Services credential button. The browser receives a Google ID token and passes it to Supabase Auth using `signInWithIdToken()`. Supabase remains responsible for validating the token and creating the application session.

Configure a Google OAuth client of type **Web application** in Google Cloud:

1. Add the production website origin to **Authorized JavaScript origins**: `https://mauamarketplace.eu.cc`.
2. Add any other origins you actually use, such as the Cloudflare Pages preview domain and `http://localhost:5173` for local development.
3. Set the app name and logo in Google Auth Platform branding.
4. Enable the Google provider in Supabase and configure the matching OAuth client ID and client secret there.
5. Set `VITE_GOOGLE_CLIENT_ID` in the Cloudflare Pages build environment and redeploy.

This client-side credential flow does not require the Supabase hosted OAuth callback as a Google redirect URI. Never expose the Google client secret in browser code.

### Supabase

Create or use a Supabase project and configure:

- The project URL and anon/publishable key in the front-end environment.
- Email authentication and the Google provider.
- The correct production site URL and any required local development URL in Auth URL Configuration.
- The database schema, policies, storage resources and migrations expected by the application.

Keep Row Level Security enabled and review policies whenever database tables or access patterns change. For production email delivery, configure a suitable SMTP provider rather than relying on Supabase's limited default email sender.

### Cloudflare Pages and R2

The site is built with Vite and deployed to Cloudflare Pages from the repository's `main` branch.

- Build command: `npm run build`
- Build output directory: `dist`
- R2 bucket binding name: `MEDIA`
- Media API route: `/api/media`

The Pages Function handles authenticated media uploads and deletion, checks the signed-in Supabase user, and stores new media in R2. During the storage migration, older Supabase Storage image paths remain supported.

For production, use a custom domain for public R2 media delivery rather than relying on the temporary `r2.dev` URL.

## Environment variables

### Front-end build variables

Set these in Cloudflare Pages under the relevant Production and Preview build environments. For local development, use `.env.local`.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `VITE_R2_MEDIA_BASE_URL` | Public base URL for R2 media; omit the trailing slash |

The `VITE_` prefix means values are included in the browser build. Only use public client values here. **Never put service-role keys, secret API keys, passwords, or migration secrets in a `VITE_` variable.**

### Cloudflare Pages Function variables and secrets

Configure these as server-side Pages variables/secrets and bind the R2 bucket as `MEDIA`.

| Name | Type | Purpose |
|---|---|---|
| `SUPABASE_URL` | Variable | Supabase project URL used by the media Function |
| `SUPABASE_ANON_KEY` | Variable | Public Supabase key used to validate user sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server-side Supabase credential for protected media/database operations |
| `MEDIA_MIGRATION_SECRET` | Secret | Protects the one-time legacy media migration endpoint |
| `ALLOWED_ORIGINS` | Secret or variable | Allowed website origins for the relevant Function configuration |

Use the exact names expected by the deployed Functions. Never commit real secret values to this repository or share them in screenshots or issue reports.

## Local development

### Requirements

- Node.js compatible with the Vite version used by the project
- npm
- Access to a configured Supabase project
- A Google OAuth Web client ID for testing Google sign-in

### Start the app

```bash
git clone https://github.com/DKTJONATHAN/mauamarketplace.git
cd mauamarketplace

cp .env.example .env.local
# Edit .env.local and add your Supabase URL, public key and Google client ID.

npm install
npm run dev
```

Vite normally serves the local app at http://localhost:5173.

### Available scripts

```bash
npm run dev          # Start the local Vite development server
npm run build        # Type-check and create the production build
npm run preview      # Preview the production build locally
npm run typecheck    # Run TypeScript checks
npm test             # Run the Vitest test suite
npm run verify:seo   # Check sitemap URLs and rendered SEO signals
```

Run the checks before submitting changes:

```bash
npm test
npm run build
```

## SEO and public website

The canonical production origin is configured in `src/config/site-origin.ts`. Site-wide name, location, descriptions and related metadata are maintained in `src/config/site.ts`.

The Vite build generates `robots.txt` with the sitemap location. The public sitemap is expected at:

- https://mauamarketplace.eu.cc/robots.txt
- https://mauamarketplace.eu.cc/sitemap.xml

When changing the production domain, update the canonical origin and review canonical tags, sitemap URLs, robots directives, Google sign-in origins, Cloudflare settings and Search Console properties together.

Use `npm run verify:seo` to run the repository's sitemap URL checks against the configured production origin. A successful local build does not by itself guarantee that search engines can fetch or index the live sitemap; verify the deployed URLs and Search Console reports as well.

## Media migration

The media Function supports a protected, batched migration from legacy Supabase Storage paths to R2. The migration endpoint is:

```text
POST /api/media?action=migrate&limit=25
```

It requires the `x-media-migration-secret` header matching the server-side `MEDIA_MIGRATION_SECRET`. Run it only when the R2 bucket, binding, public media URL and server-side credentials are configured correctly.

**Do not delete the old Supabase Storage bucket or its files until migration is complete and listing images have been checked on the live website.** The application supports legacy image paths during the transition.

## Safety, privacy and operations

- Do not treat a listing, account, phone number or seller profile as independently verified by the platform.
- Encourage members to inspect goods and documents in person and follow the listing's safety guidance.
- Keep database access protected by RLS and review policies when schema changes are made.
- Keep service credentials and migration secrets server-side.
- Configure a real support/contact address in `src/config/site.ts` before launch.
- Review the rules and safety pages for accuracy and obtain appropriate Kenyan legal and data-protection advice before relying on them as legal documents.
- Test account deletion, listing removal, media cleanup, reports and blocking after changes to those flows.

## Project structure

A few important locations in the repository:

| Path | Responsibility |
|---|---|
| `src/config/site.ts` | Site identity, location, SEO defaults and media URL helpers |
| `src/config/site-origin.ts` | Canonical production website origin |
| `functions/api/media.ts` | Cloudflare Pages media API and R2 operations |
| `.env.example` | Names and examples for local front-end configuration |
| `scripts/verify-seo.sh` | Sitemap and SEO verification script |
| `specs/marketplace_design.md` | Historical design notes; check against the current implementation before relying on it |

## Contributing

1. Create a branch for your change.
2. Keep changes focused and preserve existing working marketplace functionality.
3. Run the test suite and production build.
4. Review the change for exposed credentials, broken routes, mobile layout regressions and accessibility issues.
5. Open a pull request with a clear description and test results.

## License

No open-source license is currently declared in this repository. Unless a license is added, do not assume that the code is available for reuse, redistribution or commercial use.

---

**Maua Marketplace — your local marketplace for Maua and the wider Meru community.**
