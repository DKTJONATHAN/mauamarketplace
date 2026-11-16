create table if not exists public.advertising_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 100),
  contact_phone text not null check (char_length(contact_phone) between 9 and 16),
  website_url text,
  placement text not null check (placement in ('homepage_banner', 'category_feature', 'business_spotlight')),
  duration_days integer not null check (duration_days in (7, 30)),
  amount_kes integer not null check (amount_kes > 0),
  start_date date not null,
  creative_url text,
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'awaiting_payment', 'paid', 'scheduled', 'active', 'rejected', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.advertising_requests enable row level security;

revoke all on public.advertising_requests from anon, authenticated;
grant select, insert on public.advertising_requests to authenticated;

drop policy if exists "Users can view their own advertising requests" on public.advertising_requests;
create policy "Users can view their own advertising requests"
  on public.advertising_requests for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can submit their own advertising requests" on public.advertising_requests;
create policy "Users can submit their own advertising requests"
  on public.advertising_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);

create index if not exists advertising_requests_user_created_idx
  on public.advertising_requests (user_id, created_at desc);
