import { adminClient, requireUser } from '../_shared/auth.ts';
import { json, preflight } from '../_shared/cors.ts';
import { deleteFile } from '../_shared/github.ts';

// Erases a member's photos from GitHub, then deletes the account. The database cascades from
// there: profile, listings, saved items, blocks and conversations are removed with it.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed.' }, 405);

  const user = await requireUser(req);
  if (!user) return json(req, { error: 'Please sign in again.' }, 401);

  const db = adminClient();
  try {
    const { data } = await db.from('uploads').select('path').eq('user_id', user.id);
    for (const row of (data ?? []) as { path: string }[]) {
      await deleteFile(row.path, `Remove photo of deleted account ${row.path}`);
    }
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) return json(req, { error: 'Could not delete the account.' }, 500);
    return json(req, { deleted: true });
  } catch (err) {
    console.error('delete-account error', err instanceof Error ? err.message : err);
    return json(req, { error: 'Could not delete the account right now. Please try again.' }, 502);
  }
});
