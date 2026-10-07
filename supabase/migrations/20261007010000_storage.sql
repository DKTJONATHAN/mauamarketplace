-- Supabase Storage for listing photos. The bucket is public for image delivery;
-- writes/deletes are performed by the authenticated listing-media Edge Function.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('listing-images','listing-images',true,1500000,array['image/webp','image/jpeg'])
on conflict (id) do update set public=true,file_size_limit=1500000,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.listings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text; recent integer; from_member boolean := coalesce(auth.role(), '') = 'authenticated'
  and coalesce(current_setting('app.system_update', true), '') <> '1';
begin
  if tg_op='INSERT' then
    select count(*) into recent from public.listings where seller_id=new.seller_id and created_at>now()-interval '24 hours';
    if recent>=10 then raise exception 'You can post up to 10 listings every 24 hours. Try again later.'; end if;
    new.status:='active'; new.created_at:=now(); new.updated_at:=now(); new.expires_at:=now()+interval '60 days';
  else
    new.seller_id:=old.seller_id; new.created_at:=old.created_at; new.updated_at:=now(); new.expires_at:=least(new.expires_at,now()+interval '60 days');
    if from_member and (old.status='hidden' or new.status='hidden') then new.status:=old.status; end if;
  end if;
  foreach p in array new.images loop
    if p !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$' then raise exception 'Invalid image reference.'; end if;
    if not exists(select 1 from public.uploads u where u.path=p and u.user_id=new.seller_id) then raise exception 'One of the photos was not uploaded by your account.'; end if;
  end loop;
  return new;
end $$;