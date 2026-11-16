-- Maua Boost: verified M-PESA payments and 30-day listing promotion.
alter table public.listings
  add column if not exists featured_until timestamptz;

create index if not exists listings_featured_active_idx
  on public.listings (featured_until desc nulls last, created_at desc)
  where status = 'active';

-- Client-side listing updates must never be able to grant or extend a promotion.
create or replace function public.protect_listing_featured_until()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' then
    new.featured_until := old.featured_until;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_featured_until_guard on public.listings;
create trigger listings_featured_until_guard
before update of featured_until on public.listings
for each row execute function public.protect_listing_featured_until();

create table if not exists public.listing_boost_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  phone text not null check (phone ~ '^254[17][0-9]{8}$'),
  amount integer not null default 250 check (amount = 250),
  status text not null default 'initiating'
    check (status in ('initiating', 'pending', 'paid', 'failed')),
  reference text not null unique,
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt_number text,
  result_code integer,
  result_description text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists listing_boost_receipt_unique_idx
  on public.listing_boost_payments (mpesa_receipt_number)
  where mpesa_receipt_number is not null;
create index if not exists listing_boost_payments_user_idx
  on public.listing_boost_payments (user_id, created_at desc);
create index if not exists listing_boost_payments_listing_idx
  on public.listing_boost_payments (listing_id, created_at desc);

alter table public.listing_boost_payments enable row level security;
revoke all on public.listing_boost_payments from anon, authenticated;
grant select on public.listing_boost_payments to authenticated;
create policy "Sellers can view their own boost payments"
  on public.listing_boost_payments for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.apply_listing_boost_payment(
  p_payment_id uuid,
  p_checkout_request_id text,
  p_result_code integer,
  p_result_description text,
  p_receipt_number text,
  p_amount numeric,
  p_phone text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  payment public.listing_boost_payments%rowtype;
begin
  select * into payment
  from public.listing_boost_payments
  where id = p_payment_id
    and checkout_request_id = p_checkout_request_id
  for update;

  if not found then
    return false;
  end if;

  if payment.status = 'paid' then
    return true;
  end if;

  if payment.status <> 'pending' then
    return false;
  end if;

  if p_result_code = 0 then
    if p_receipt_number is null
      or length(p_receipt_number) < 6
      or p_amount is distinct from payment.amount::numeric
      or p_phone is distinct from payment.phone
    then
      return false;
    end if;

    update public.listing_boost_payments
      set status = 'paid',
          mpesa_receipt_number = p_receipt_number,
          result_code = p_result_code,
          result_description = left(coalesce(p_result_description, 'Payment confirmed'), 500),
          paid_at = now(),
          updated_at = now()
      where id = payment.id;

    update public.listings
      set featured_until = greatest(coalesce(featured_until, now()), now()) + interval '30 days'
      where id = payment.listing_id
        and seller_id = payment.user_id
        and status = 'active';

    if not found then
      raise exception 'The listing is no longer eligible for promotion.';
    end if;
    return true;
  end if;

  update public.listing_boost_payments
    set status = 'failed',
        result_code = p_result_code,
        result_description = left(coalesce(p_result_description, 'Payment was not completed'), 500),
        updated_at = now()
    where id = payment.id;
  return false;
end;
$$;

revoke all on function public.apply_listing_boost_payment(uuid, text, integer, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_listing_boost_payment(uuid, text, integer, text, text, numeric, text) to service_role;
