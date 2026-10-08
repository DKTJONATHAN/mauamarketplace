import { env } from './env';
import { supabase } from './supabase';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again to continue.');
  return { Authorization: `Bearer ${token}`, apikey: env.supabaseKey };
}

async function call<T>(action: string, init: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init.headers as Record<string, string> | undefined) };
  let res: Response;
  try {
    res = await fetch(`/api/media?action=${action}`, { ...init, method: 'POST', headers });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body;
}

/** Uploads one prepared image through the Cloudflare Pages media API backed by R2. */
export async function uploadImage(blob: Blob): Promise<string> {
  const { path } = await call<{ path: string }>('upload', { headers: { 'Content-Type': blob.type }, body: blob });
  return path;
}

/** Best-effort removal of images that are no longer used by any listing. */
export async function deleteImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await call('delete-files', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths }) });
}

/** Deletes a listing and its photos. */
export async function deleteListingWithMedia(listingId: string): Promise<void> {
  await call('delete-listing', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId }) });
}

export async function deleteMyAccount(): Promise<void> {
  const headers = await authHeader();
  const res = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Could not delete the account. Please try again.');
  }
}
