-- Maua Marketplace: schema, row level security, and server-side safety rules.
-- Run once (supabase db push, or paste into the Supabase SQL editor).

-- =====================================================================
-- Profiles: public display name only. Email never leaves auth.users.
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Members edit their own profile" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- New accounts get a random display name unless they chose one. We deliberately do NOT copy the
-- real name from Google, so nobody is publicly named without choosing it.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  chosen text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40);
begin
  if char_length(chosen) < 2 then
    chosen := 'Member ' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  end if;
  insert into public.profiles (id, display_name) values (new.id, chosen);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Uploads: bookkeeping for photos committed to GitHub (written only by the edge function).
-- =====================================================================
create table public.uploads (
  path text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  bytes integer not null,
  created_at timestamptz not null default now()
);
create index uploads_user_created_idx on public.uploads (user_id, created_at desc);
alter table public.uploads enable row level security; -- no policies: clients cannot touch it

-- =====================================================================
-- Listings
-- =====================================================================
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 100),
  description text not null check (char_length(description) between 20 and 2000),
  category text not null check (category ~ '^[a-z0-9-]{2,40}$'),
  price numeric(12, 0) check (price is null or (price >= 0 and price <= 1000000000)),
  negotiable boolean not null default false,
  condition text check (condition in ('new', 'like_new', 'good', 'fair', 'for_parts')),
  location text not null check (char_length(location) between 2 and 60),
  images text[] not null default '{}' check (cardinality(images) <= 6),
  status text not null default 'active' check (status in ('active', 'sold', 'hidden')),
  expires_at timestamptz not null default now() + interval '60 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_active_new_idx on public.listings (created_at desc) where status = 'active';
create index listings_active_cat_idx on public.listings (category, created_at desc) where status = 'active';
create index listings_seller_idx on public.listings (seller_id, created_at desc);

alter table public.listings enable row level security;

create policy "Anyone can view live and sold listings" on public.listings for select
  using (status in ('active', 'sold') or seller_id = auth.uid());
create policy "Members create their own listings" on public.listings for insert
  with check (seller_id = auth.uid());
create policy "Members edit their own listings" on public.listings for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());
-- No delete policy: deletion goes through the listing-media edge function so photos are removed too.

create function public.listings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p text;
  recent integer;
  from_member boolean := coalesce(auth.role(), '') = 'authenticated'
    and coalesce(current_setting('app.system_update', true), '') <> '1';
begin
  if tg_op = 'INSERT' then
    select count(*) into recent from public.listings
      where seller_id = new.seller_id and created_at > now() - interval '24 hours';
    if recent >= 10 then
      raise exception 'You can post up to 10 listings every 24 hours. Try again later.';
    end if;
    new.status := 'active';
    new.created_at := now();
    new.updated_at := now();
    new.expires_at := now() + interval '60 days';
  else
    new.seller_id := old.seller_id;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.expires_at := least(new.expires_at, now() + interval '60 days');
    if from_member then
      -- Members may only switch between active and sold. Hidden (reported) listings stay hidden.
      if old.status = 'hidden' or new.status = 'hidden' then
        new.status := old.status;
      end if;
    end if;
  end if;

  foreach p in array new.images loop
    if p !~ '^uploads/[0-9]{4}/[0-9]{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$' then
      raise exception 'Invalid image reference.';
    end if;
    if not exists (select 1 from public.uploads u where u.path = p and u.user_id = new.seller_id) then
      raise exception 'One of the photos was not uploaded by your account.';
    end if;
  end loop;
  return new;
end $$;

create trigger listings_guard_trg before insert or update on public.listings
  for each row execute function public.listings_guard();

-- Phone numbers live in their own table so only signed-in members can read them.
create table public.listing_contacts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  phone text not null check (phone ~ '^\+254[17][0-9]{8}$')
);
alter table public.listing_contacts enable row level security;

create policy "Signed-in members can read contact numbers" on public.listing_contacts for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and (l.status in ('active', 'sold') or l.seller_id = auth.uid())
    )
  );
create policy "Sellers add contact numbers" on public.listing_contacts for insert
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "Sellers change contact numbers" on public.listing_contacts for update
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "Sellers remove contact numbers" on public.listing_contacts for delete
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- =====================================================================
-- Saved listings
-- =====================================================================
create table public.saved_listings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.saved_listings enable row level security;
create policy "Members see their saved listings" on public.saved_listings for select using (user_id = auth.uid());
create policy "Members save listings" on public.saved_listings for insert with check (user_id = auth.uid());
create policy "Members unsave listings" on public.saved_listings for delete using (user_id = auth.uid());

-- =====================================================================
-- Blocks
-- =====================================================================
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "Members see who they blocked" on public.blocks for select using (blocker_id = auth.uid());
create policy "Members block others" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "Members unblock others" on public.blocks for delete using (blocker_id = auth.uid());

-- Needs to see blocks in both directions, which row level security would hide from the sender.
create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- =====================================================================
-- Conversations & messages (private between the two people)
-- =====================================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  unique (listing_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
alter table public.conversations enable row level security;
create policy "Participants see their conversations" on public.conversations for select
  using (auth.uid() in (buyer_id, seller_id));
-- Conversations are created through start_conversation() only.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;
alter table public.messages enable row level security;

create policy "Participants read messages" on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
  ));
create policy "Participants send messages" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.buyer_id, c.seller_id)
        and not public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

create function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent integer;
begin
  select count(*) into recent from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 20 then
    raise exception 'You are sending messages too fast. Wait a minute and try again.';
  end if;
  return new;
end $$;

create trigger messages_before_insert_trg before insert on public.messages
  for each row execute function public.messages_before_insert();

create function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

create trigger messages_after_insert_trg after insert on public.messages
  for each row execute function public.messages_after_insert();

create function public.start_conversation(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lst public.listings;
  cid uuid;
  recent integer;
begin
  if me is null then raise exception 'Sign in to message sellers.'; end if;
  select * into lst from public.listings where id = p_listing_id and status = 'active';
  if not found then raise exception 'This listing is no longer available.'; end if;
  if lst.seller_id = me then raise exception 'This is your own listing.'; end if;
  if public.is_blocked_between(me, lst.seller_id) then
    raise exception 'You cannot message this seller.';
  end if;
  select id into cid from public.conversations where listing_id = lst.id and buyer_id = me;
  if cid is not null then return cid; end if;
  select count(*) into recent from public.conversations
    where buyer_id = me and created_at > now() - interval '24 hours';
  if recent >= 30 then raise exception 'You have started too many conversations today. Try again tomorrow.'; end if;
  insert into public.conversations (listing_id, listing_title, buyer_id, seller_id)
    values (lst.id, lst.title, me, lst.seller_id) returning id into cid;
  return cid;
end $$;

create function public.mark_conversation_read(p_conversation_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages m set read_at = now()
  where m.conversation_id = p_conversation_id
    and m.sender_id <> auth.uid()
    and m.read_at is null
    and exists (
      select 1 from public.conversations c
      where c.id = p_conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    );
$$;

create function public.my_conversations() returns table (
  id uuid, listing_id uuid, listing_title text, listing_image text,
  other_user_id uuid, other_name text, last_body text, last_at timestamptz, unread integer
)
language sql stable security invoker set search_path = public as $$
  select
    c.id, c.listing_id, c.listing_title, l.images[1],
    o.id, o.display_name, lm.body, c.last_message_at,
    (select count(*)::integer from public.messages m
      where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  join public.profiles o on o.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  left join public.listings l on l.id = c.listing_id
  left join lateral (
    select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where auth.uid() in (c.buyer_id, c.seller_id)
  order by c.last_message_at desc;
$$;

-- =====================================================================
-- Reports: five different members reporting a listing hides it automatically.
-- =====================================================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('scam', 'prohibited', 'stolen', 'wrong_category', 'abusive', 'underage', 'spam', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null),
  unique (reporter_id, listing_id),
  unique (reporter_id, reported_user_id)
);
alter table public.reports enable row level security;
create policy "Members file reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "Members see their own reports" on public.reports for select using (reporter_id = auth.uid());

create function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare reporters integer;
begin
  if new.listing_id is not null then
    if exists (select 1 from public.listings where id = new.listing_id and seller_id = new.reporter_id) then
      raise exception 'You cannot report your own listing.';
    end if;
    select count(distinct reporter_id) into reporters from public.reports where listing_id = new.listing_id;
    if reporters >= 5 then
      perform set_config('app.system_update', '1', true);
      update public.listings set status = 'hidden' where id = new.listing_id and status <> 'hidden';
      perform set_config('app.system_update', '', true);
    end if;
  end if;
  return new;
end $$;

create trigger reports_after_insert_trg after insert on public.reports
  for each row execute function public.reports_after_insert();

-- =====================================================================
-- Privileges: least privilege for the browser roles.
-- =====================================================================
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select on public.profiles, public.listings to anon, authenticated;
grant update (display_name, accepted_terms_at) on public.profiles to authenticated;

grant insert, update on public.listings to authenticated;
grant select, insert, update, delete on public.listing_contacts to authenticated;
grant select, insert, delete on public.saved_listings to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.reports to authenticated;

grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Live chat updates (Realtime respects the row level security policies above).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
