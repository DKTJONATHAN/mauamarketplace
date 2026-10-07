# Maua Marketplace: design notes

## Purpose
A free classifieds notice board for Maua. Members post items, services, produce and property; other members find them and
talk to the seller. The site is unregulated: it never touches money, never verifies anyone, and says so everywhere it matters.

## Requirements (EARS)
- When a visitor opens the site, the system shall show live listings without requiring an account.
- When a visitor wants to message a seller, save a listing, see a phone number or post, the system shall require a signed-in account.
- The system shall allow sign-up and login with email and password, and with Google.
- When a member publishes a listing with photos, the system shall store each photo in the `uploads/` folder of the repository's `media` branch and show it to every visitor.
- While a photo is being prepared in the browser, the system shall remove all EXIF metadata (including GPS) and shrink it to 1280px.
- Where a seller adds a phone number, the system shall reveal it only to signed-in members who confirm a safety reminder.
- When five different members report one listing, the system shall hide it automatically.
- When a member blocks another, the system shall stop messages in both directions.
- When an incoming chat message matches a scam pattern, the system shall show a warning under it and shall not block it.
- When a member deletes their account, the system shall delete their photos from GitHub, then their data.
- Listings in the house-help and jobs categories shall require the poster to confirm everyone involved is 18 or older.

## Architecture
| Concern | Choice | Why |
|---|---|---|
| Front end | React 19, TypeScript (strict), Vite, hash routing | Works on GitHub Pages with no server rewrites; OAuth uses PKCE so `?code=` does not clash with the hash. |
| Data and auth | Supabase (Postgres, Auth, Realtime) | Row Level Security enforces who can see and change what. |
| Photos | Edge function `listing-media` commits to GitHub | A GitHub token can never be put in browser code. The function checks the session, file signature, size and rate limits. |
| Hosting | GitHub Pages via Actions | Free, and photos live in the same repository on a separate branch so uploads never trigger a site rebuild. |

## Security decisions
- Row Level Security on every table; browser roles get only the privileges they need.
- Email is never copied into a public table. Google display names are not imported.
- Phone numbers sit in their own table readable only by signed-in members.
- Image paths are validated by regex and must belong to the uploader, so listings cannot hot-link arbitrary URLs.
- Members cannot unhide a reported listing; only the database owner can.
- Rate limits: 10 listings per day, 40 uploads per hour, 20 messages per minute, 30 new conversations per day.
- React escapes all user text; no `dangerouslySetInnerHTML` anywhere.

## Out of scope for this version
Payments, ID verification, ratings, push notifications, per-listing link previews on WhatsApp (needs server rendering), an admin dashboard.
