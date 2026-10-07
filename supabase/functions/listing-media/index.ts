import { adminClient, requireUser } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/cors.ts';
import { deleteFile, putFile } from '../_shared/github.ts';

const MAX_BYTES = 1_500_000;
const MAX_PER_HOUR = 40;
const MAX_PER_DAY = 120;
const PATH_RE = /^uploads\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/;

function detectType(b: Uint8Array): 'webp' | 'jpg' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Please sign in again.' }, 401);
  if (!user.email_confirmed_at) return json(req, { error: 'Confirm your email address before uploading.' }, 403);

  const db = adminClient();
  const action = new URL(req.url).searchParams.get('action');

  try {
    if (action === 'upload') {
      const declared = Number(req.headers.get('content-length') ?? '0');
      if (declared > MAX_BYTES) return json(req, { error: 'That photo is too large.' }, 413);
      const bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_BYTES) return json(req, { error: 'That photo is too large.' }, 413);
      const ext = detectType(bytes);
      if (!ext) return json(req, { error: 'Only JPEG or WebP photos are accepted.' }, 415);

      const hourAgo = new Date(Date.now() - 3600_000).toISOString();
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const [hour, day] = await Promise.all([
        db.from('uploads').select('path', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', hourAgo),
        db.from('uploads').select('path', { count: 'exact', head: true }).eq('user_id', user.id).gt('created_at', dayAgo),
      ]);
      if ((hour.count ?? 0) >= MAX_PER_HOUR || (day.count ?? 0) >= MAX_PER_DAY) {
        return json(req, { error: 'You have uploaded a lot of photos recently. Please try again later.' }, 429);
      }

      const now = new Date();
      const path = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
      await putFile(path, bytes, `Add listing photo ${path}`);
      const { error } = await db.from('uploads').insert({ path, user_id: user.id, bytes: bytes.length });
      if (error) {
        await deleteFile(path, `Remove orphaned photo ${path}`).catch(() => {});
        return json(req, { error: 'Could not record the upload.' }, 500);
      }
      return json(req, { path });
    }

    if (action === 'delete-files') {
      const { paths } = (await req.json()) as { paths?: unknown };
      if (!Array.isArray(paths) || paths.length === 0 || paths.length > 12 || !paths.every((p) => typeof p === 'string' && PATH_RE.test(p))) {
        return json(req, { error: 'Invalid request.' }, 400);
      }
      const owned = await db.from('uploads').select('path').eq('user_id', user.id).in('path', paths);
      const mine = ((owned.data ?? []) as { path: string }[]).map((r) => r.path);
      let removed = 0;
      for (const path of mine) {
        // Never delete a photo that a listing still shows.
        const used = await db.from('listings').select('id', { count: 'exact', head: true }).contains('images', [path]);
        if ((used.count ?? 0) > 0) continue;
        await deleteFile(path, `Remove listing photo ${path}`);
        await db.from('uploads').delete().eq('path', path);
        removed++;
      }
      return json(req, { removed });
    }

    if (action === 'delete-listing') {
      const { listingId } = (await req.json()) as { listingId?: unknown };
      if (typeof listingId !== 'string' || !/^[0-9a-f-]{36}$/.test(listingId)) return json(req, { error: 'Invalid request.' }, 400);
      const { data: listing } = await db.from('listings').select('id,seller_id,images').eq('id', listingId).maybeSingle();
      if (!listing || listing.seller_id !== user.id) return json(req, { error: 'Listing not found.' }, 404);
      for (const path of (listing.images ?? []) as string[]) {
        if (!PATH_RE.test(path)) continue;
        await deleteFile(path, `Remove listing photo ${path}`);
        await db.from('uploads').delete().eq('path', path);
      }
      const { error } = await db.from('listings').delete().eq('id', listingId);
      if (error) return json(req, { error: 'Could not delete the listing.' }, 500);
      return json(req, { deleted: true });
    }

    return json(req, { error: 'Unknown action.' }, 400);
  } catch (err) {
    console.error('listing-media error', action, err instanceof Error ? err.message : err);
    return json(req, { error: 'The photo service is unavailable right now. Please try again in a moment.' }, 502);
  }
});
