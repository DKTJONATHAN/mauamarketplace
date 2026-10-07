create or replace function public.is_permanent_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

drop policy if exists "Permanent members create listings" on public.listings;
create policy "Permanent members create listings" on public.listings as restrictive for insert to authenticated
with check (public.is_permanent_user());

drop policy if exists "Permanent members edit listings" on public.listings;
create policy "Permanent members edit listings" on public.listings as restrictive for update to authenticated
using (public.is_permanent_user()) with check (public.is_permanent_user());

drop policy if exists "Permanent members manage contact numbers" on public.listing_contacts;
create policy "Permanent members manage contact numbers" on public.listing_contacts as restrictive for all to authenticated
using (public.is_permanent_user()) with check (public.is_permanent_user());

drop policy if exists "Permanent members read contact numbers" on public.listing_contacts;
create policy "Permanent members read contact numbers" on public.listing_contacts as restrictive for select to authenticated
using (public.is_permanent_user());

drop policy if exists "Permanent members read conversations" on public.conversations;
create policy "Permanent members read conversations" on public.conversations as restrictive for select to authenticated
using (public.is_permanent_user());

drop policy if exists "Permanent members read messages" on public.messages;
create policy "Permanent members read messages" on public.messages as restrictive for select to authenticated
using (public.is_permanent_user());

drop policy if exists "Permanent members send messages" on public.messages;
create policy "Permanent members send messages" on public.messages as restrictive for insert to authenticated
with check (public.is_permanent_user());

create or replace function public.start_conversation(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); lst public.listings; cid uuid; recent integer;
begin
  if me is null or not public.is_permanent_user() then raise exception 'Please log in with an account to message sellers.'; end if;
  select * into lst from public.listings where id = p_listing_id and status = 'active';
  if not found then raise exception 'This listing is no longer available.'; end if;
  if lst.seller_id = me then raise exception 'This is your own listing.'; end if;
  if public.is_blocked_between(me, lst.seller_id) then raise exception 'You cannot message this seller.'; end if;
  select id into cid from public.conversations where listing_id = lst.id and buyer_id = me;
  if cid is not null then return cid; end if;
  select count(*) into recent from public.conversations where buyer_id = me and created_at > now() - interval '24 hours';
  if recent >= 30 then raise exception 'You have started too many conversations today. Try again tomorrow.'; end if;
  insert into public.conversations (listing_id, listing_title, buyer_id, seller_id)
    values (lst.id, lst.title, me, lst.seller_id) returning id into cid;
  return cid;
end $$;

create or replace function public.my_conversations()
returns table(id uuid, listing_id uuid, listing_title text, listing_image text, other_user_id uuid, other_name text, last_body text, last_at timestamptz, unread integer)
language sql stable set search_path = public
as $$
  select c.id, c.listing_id, c.listing_title, l.images[1], o.id, o.display_name, lm.body, c.last_message_at,
    (select count(*)::integer from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null)
  from public.conversations c
  join public.profiles o on o.id = case when c.buyer_id = auth.uid() then c.seller_id else c.buyer_id end
  left join public.listings l on l.id = c.listing_id
  left join lateral (select m.body from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
  where public.is_permanent_user() and auth.uid() in (c.buyer_id, c.seller_id)
  order by c.last_message_at desc
$$;