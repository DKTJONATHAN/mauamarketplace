/**
 * Everything that makes this site "Maua" lives here. To launch a Meru town version later,
 * copy the project, change these values, and point `media` at that deployment's repo.
 */
export const site = {
  name: 'Maua Marketplace',
  place: 'Maua',
  region: 'Meru County',
  locations: ['Maua Town', 'Laare', 'Kangeta', 'Muthara', 'Mikinduri', 'Nkubu', 'Meru Town'],
  /** Shown on the Rules page so people can ask for content to be removed. Leave empty to hide it. */
  contactEmail: '',
  listingLifetimeDays: 60,
  maxImages: 6,
  /** Listing photos are committed to this branch by the listing-media edge function. */
  media: { owner: 'DKTJONATHAN', repo: 'mauamarketplace', branch: 'media' },
} as const;

export const mediaBaseUrl = `https://raw.githubusercontent.com/${site.media.owner}/${site.media.repo}/${site.media.branch}`;

export function mediaUrl(path: string): string {
  return `${mediaBaseUrl}/${path}`;
}

/** Absolute URL of the site root, used for auth redirects and share links. */
export function siteUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
