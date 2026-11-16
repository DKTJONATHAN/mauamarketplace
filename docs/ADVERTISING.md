# Advertising operations

Maua Marketplace accepts paid advertising requests through the `/advertise` page.

## Booking lifecycle

1. A signed-in member selects a placement and 7- or 30-day duration.
2. The request is stored in `public.advertising_requests`.
3. The app sends an M-Pesa STK Push using the existing Daraja production configuration.
4. The callback verifies the receipt, exact amount and payer phone against the request.
5. A verified payment creates a matching `public.advertisements` row with `status = 'pending_review'`.
6. Review the business, artwork, destination URL and requested dates in Supabase Table Editor.
7. Set the advertisement's status to `active` to publish it. The public site only returns active ads within their scheduled date range.

## Placements

- `homepage_banner`: homepage sponsored slot.
- `category_feature`: category page sponsored slot.
- `business_spotlight`: browse/discovery sponsored slot.

## Important controls

- Do not set an advert to active until its content and destination have been reviewed.
- The public client can read only active, currently scheduled advertisement rows.
- Members can read only their own booking requests and cannot update payment state.
- Payment state is written by the Cloudflare Pages function using the server-side Supabase service role.
- Never put the Supabase service-role key or Daraja secrets in frontend variables.
- A paid request is not automatically public; it remains pending review until an administrator activates it.
