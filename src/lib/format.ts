export function formatPrice(price: number | null, suffix = ''): string {
  if (price === null) return 'Price on request';
  if (price === 0) return 'Free';
  return `KSh ${price.toLocaleString('en-KE')}${suffix}`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), 'day');
  return rtf.format(Math.round(seconds / (86400 * 30)), 'month');
}

export function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

export function isNewMember(iso: string, now: number = Date.now()): boolean {
  return now - new Date(iso).getTime() < 14 * 86400 * 1000;
}

export function daysLeft(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86400000);
}
