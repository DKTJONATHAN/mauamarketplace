create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.advertising_requests(id) on delete cascade,
  business_name text not null,
  headline text,
  body text,
  website_url text,
  creative_url text,
  placement text not null check (placement in ('homepage_banner', 'category_feature', 'business_spotlight')),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending_review' check (status in ('pending_review', 'active', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
alter table public.advertisements enable row level security;
revoke all on public.advertisements from anon, authenticated;
grant select on public.advertisements to anon, authenticated;
drop policy if exists "Public can view active scheduled advertisements" on public.advertisements;
create policy "Public can view active scheduled advertisements"
  on public.advertisements for select to anon, authenticated
  using (status = 'active' and start_date <= (now() at time zone 'Africa/Nairobi')::date and end_date >= (now() at time zone 'Africa/Nairobi')::date);
create index if not exists advertisements_slot_schedule_idx
  on public.advertisements (placement, status, start_date, end_date);