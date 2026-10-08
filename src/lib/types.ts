export type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';
export type ListingStatus = 'active' | 'sold' | 'hidden';

export const conditionLabels: Record<Condition, string> = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  for_parts: 'For parts',
};

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
  accepted_terms_at: string | null;
}

export interface ListingSummary {
  id: string;
  seller_id: string;
  title: string;
  price: number | null;
  negotiable: boolean;
  category: string;
  condition: Condition | null;
  location: string;
  images: string[];
  status: ListingStatus;
  created_at: string;
}

export interface Listing extends ListingSummary {
  description: string;
  seller: { display_name: string; created_at: string } | null;
}

export interface ConversationRow {
  id: string;
  listing_id: string | null;
  listing_title: string;
  listing_image: string | null;
  other_user_id: string;
  other_name: string;
  last_body: string | null;
  last_at: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface BrowseFilters {
  q: string;
  cat: string;
  min: string;
  max: string;
  cond: string;
  loc: string;
  sort: 'new' | 'price_asc' | 'price_desc';
}
