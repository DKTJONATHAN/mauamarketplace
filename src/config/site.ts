import { env } from '../lib/env';

/** Site-wide configuration. */
export const site = {
  name: 'Maua Marketplace',
  place: 'Maua',
  region: 'Meru County',
  locations: ['Maua Town', 'Laare', 'Kangeta', 'Muthara', 'Mikinduri', 'Nkubu', 'Meru Town'],
  contactEmail: '',
  listingLifetimeDays: 60,
  maxImages: 6,
} as const;

export const mediaBaseUrl = env.supabaseUrl ? `${env.supabaseUrl}/storage/v1/object/public/listing-images` : '';

export function mediaUrl(path: string): string {
  return `${mediaBaseUrl}/${path}`;
}

export function siteUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
