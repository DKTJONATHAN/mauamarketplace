alter table public.listings
  alter column expires_at drop default;

update public.listings
set expires_at = null;

alter table public.listings
  alter column expires_at drop not null;
