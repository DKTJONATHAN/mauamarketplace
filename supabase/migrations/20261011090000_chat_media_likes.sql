-- Chat attachments and lightweight message reactions.
-- Existing conversation/message RLS remains the source of truth for who can see messages.
alter table public.messages
  add column if not exists image_path text;

create table if not exists public.message_likes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_likes enable row level security;

drop policy if exists "Conversation members can read message likes" on public.message_likes;
create policy "Conversation members can read message likes"
  on public.message_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages as m
      where m.id = public.message_likes.message_id
    )
  );

drop policy if exists "Members can like messages they can read" on public.message_likes;
create policy "Members can like messages they can read"
  on public.message_likes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.messages as m
      where m.id = public.message_likes.message_id
    )
  );

drop policy if exists "Members can remove their own message likes" on public.message_likes;
create policy "Members can remove their own message likes"
  on public.message_likes
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.message_likes to authenticated;

create index if not exists message_likes_message_id_idx
  on public.message_likes (message_id);
