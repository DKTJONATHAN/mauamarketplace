create or replace function public.close_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.is_permanent_user() then
    raise exception 'Please log in with an account to close a chat.';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and me in (c.buyer_id, c.seller_id)
  ) then
    raise exception 'You are not allowed to close this chat.';
  end if;

  delete from public.messages
  where conversation_id = p_conversation_id;

  delete from public.conversations
  where id = p_conversation_id;
end
$function$;

revoke execute on function public.close_conversation(uuid) from public, anon;
grant execute on function public.close_conversation(uuid) to authenticated;
