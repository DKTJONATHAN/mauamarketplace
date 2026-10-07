import { supabase } from './supabase';
import type {
  BrowseFilters, ChatMessage, Condition, ConversationRow, Listing, ListingSummary, Profile,
} from './types';

export const PAGE_SIZE = 24;

const SUMMARY_COLUMNS =
  'id,seller_id,title,price,negotiable,category,condition,location,images,status,created_at,expires_at';

interface DbError {
  message: string;
  code?: string;
}

function fail(error: DbError | null): void {
  if (!error) return;
  if (error.code === '23505') throw new Error('You have already done that.');
  if (error.code === '42501') throw new Error('You are not allowed to do that.');
  throw new Error(error.message || 'Something went wrong. Please try again.');
}

/** Removes characters that have special meaning inside PostgREST filters. */
export function cleanSearchTerm(input: string): string {
  return input.replace(/[%_,()*"'\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/* ---------- Listings ---------- */

export async function fetchListings(filters: BrowseFilters, page: number) {
  let query = supabase
    .from('listings')
    .select(SUMMARY_COLUMNS, { count: 'exact' })
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  if (filters.cat) query = query.eq('category', filters.cat);
  const term = cleanSearchTerm(filters.q);
  if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  const loc = cleanSearchTerm(filters.loc);
  if (loc) query = query.ilike('location', `%${loc}%`);
  const min = Number(filters.min);
  const max = Number(filters.max);
  if (filters.min !== '' && Number.isFinite(min)) query = query.gte('price', min);
  if (filters.max !== '' && Number.isFinite(max)) query = query.lte('price', max);
  if (filters.cond) query = query.eq('condition', filters.cond);

  if (filters.sort === 'price_asc') query = query.order('price', { ascending: true, nullsFirst: false });
  else if (filters.sort === 'price_desc') query = query.order('price', { ascending: false, nullsFirst: false });
  query = query.order('created_at', { ascending: false });

  const from = page * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  fail(error);
  const items = (data ?? []) as ListingSummary[];
  return { items, total: count ?? 0, hasMore: from + items.length < (count ?? 0) };
}

export async function countActiveListings(): Promise<number> {
  const { count, error } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());
  fail(error);
  return count ?? 0;
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(`${SUMMARY_COLUMNS},description,seller:profiles!listings_seller_id_fkey(display_name,created_at)`)
    .eq('id', id)
    .maybeSingle();
  fail(error);
  return (data as Listing | null) ?? null;
}

export async function fetchSellerListings(sellerId: string): Promise<ListingSummary[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(SUMMARY_COLUMNS)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(48);
  fail(error);
  return (data ?? []) as ListingSummary[];
}

export async function fetchMyListings(userId: string): Promise<ListingSummary[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(SUMMARY_COLUMNS)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as ListingSummary[];
}

export interface ListingWrite {
  title: string;
  description: string;
  category: string;
  price: number | null;
  negotiable: boolean;
  condition: Condition | null;
  location: string;
  images: string[];
}

export async function createListing(input: ListingWrite): Promise<string> {
  const { data, error } = await supabase.from('listings').insert(input).select('id').single();
  fail(error);
  return (data as { id: string }).id;
}

export async function updateListing(id: string, input: ListingWrite): Promise<void> {
  const { error } = await supabase.from('listings').update(input).eq('id', id);
  fail(error);
}

export async function setListingStatus(id: string, status: 'active' | 'sold'): Promise<void> {
  const { error } = await supabase.from('listings').update({ status }).eq('id', id);
  fail(error);
}

export async function renewListing(id: string, days: number): Promise<void> {
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await supabase.from('listings').update({ expires_at: expires }).eq('id', id);
  fail(error);
}

/* ---------- Contact phone (only signed-in members can read it) ---------- */

export async function fetchContactPhone(listingId: string): Promise<string | null> {
  const { data, error } = await supabase.from('listing_contacts').select('phone').eq('listing_id', listingId).maybeSingle();
  fail(error);
  return (data as { phone: string } | null)?.phone ?? null;
}

export async function saveContactPhone(listingId: string, phone: string | null): Promise<void> {
  if (phone) {
    const { error } = await supabase.from('listing_contacts').upsert({ listing_id: listingId, phone });
    fail(error);
  } else {
    const { error } = await supabase.from('listing_contacts').delete().eq('listing_id', listingId);
    fail(error);
  }
}

/* ---------- Saved listings ---------- */

export async function fetchSavedIds(): Promise<string[]> {
  const { data, error } = await supabase.from('saved_listings').select('listing_id');
  fail(error);
  return ((data ?? []) as { listing_id: string }[]).map((r) => r.listing_id);
}

export async function fetchSavedListings(): Promise<ListingSummary[]> {
  const { data, error } = await supabase
    .from('saved_listings')
    .select(`created_at,listing:listings(${SUMMARY_COLUMNS})`)
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as unknown as { listing: ListingSummary | null }[])
    .map((r) => r.listing)
    .filter((l): l is ListingSummary => l !== null);
}

export async function setSaved(listingId: string, saved: boolean): Promise<void> {
  if (saved) {
    const { error } = await supabase.from('saved_listings').insert({ listing_id: listingId });
    if (error && error.code !== '23505') fail(error);
  } else {
    const { error } = await supabase.from('saved_listings').delete().eq('listing_id', listingId);
    fail(error);
  }
}

/* ---------- Messaging ---------- */

export async function startConversation(listingId: string): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', { p_listing_id: listingId });
  fail(error);
  return data as string;
}

export async function fetchConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase.rpc('my_conversations');
  fail(error);
  return (data ?? []) as ConversationRow[];
}

export async function fetchConversation(id: string): Promise<ConversationRow | null> {
  const rows = await fetchConversations();
  return rows.find((r) => r.id === id) ?? null;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id,conversation_id,sender_id,body,created_at,read_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  fail(error);
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, body });
  if (error?.code === '42501') {
    throw new Error('Message not sent. This conversation is no longer open to new messages.');
  }
  fail(error);
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  fail(error);
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .neq('sender_id', userId);
  fail(error);
  return count ?? 0;
}

/* ---------- Blocks & reports ---------- */

export async function fetchBlockedUsers(): Promise<{ blocked_id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id,profile:profiles!blocks_blocked_id_fkey(display_name)')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as unknown as { blocked_id: string; profile: { display_name: string } | null }[]).map((r) => ({
    blocked_id: r.blocked_id,
    name: r.profile?.display_name ?? 'Member',
  }));
}

export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  if (blocked) {
    const { error } = await supabase.from('blocks').insert({ blocked_id: userId });
    if (error && error.code !== '23505') fail(error);
  } else {
    const { error } = await supabase.from('blocks').delete().eq('blocked_id', userId);
    fail(error);
  }
}

export type ReportReason = 'scam' | 'prohibited' | 'stolen' | 'wrong_category' | 'abusive' | 'underage' | 'spam' | 'other';

export const reportReasons: { value: ReportReason; label: string }[] = [
  { value: 'scam', label: 'Looks like a scam' },
  { value: 'prohibited', label: 'Prohibited or illegal item' },
  { value: 'stolen', label: 'Possibly stolen' },
  { value: 'underage', label: 'Involves someone under 18' },
  { value: 'abusive', label: 'Abusive or threatening' },
  { value: 'wrong_category', label: 'Wrong category or misleading' },
  { value: 'spam', label: 'Spam or duplicate' },
  { value: 'other', label: 'Something else' },
];

export async function submitReport(input: {
  listingId?: string;
  userId?: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    listing_id: input.listingId ?? null,
    reported_user_id: input.userId ?? null,
    reason: input.reason,
    details: input.details.trim() || null,
  });
  fail(error);
}

/* ---------- Profiles ---------- */

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('id,display_name,created_at,accepted_terms_at').eq('id', id).maybeSingle();
  fail(error);
  return (data as Profile | null) ?? null;
}

export async function fetchPublicProfile(id: string): Promise<{ id: string; display_name: string; created_at: string } | null> {
  const { data, error } = await supabase.from('profiles').select('id,display_name,created_at').eq('id', id).maybeSingle();
  fail(error);
  return (data as { id: string; display_name: string; created_at: string } | null) ?? null;
}

export async function updateDisplayName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', id);
  fail(error);
}

export async function acceptTerms(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ accepted_terms_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}
