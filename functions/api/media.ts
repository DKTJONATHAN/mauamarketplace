interface Env {
  MEDIA: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MEDIA_MIGRATION_SECRET: string;
}

const MAX_BYTES = 1_500_000;
const MAX_PER_HOUR = 40;
const MAX_PER_DAY = 120;
const OLD_PATH_RE = /^uploads\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$/i;
const R2_PATH_RE = /^r2\/(uploads\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg))$/i;

function json(data: unknown, status = 200, origin?: string): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {}),
    },
  });
}

function supabaseHeaders(env: Env, service = false): HeadersInit {
  return {
    apikey: service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${service ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function requireUser(req: Request, env: Env): Promise<{ id: string; email_confirmed_at?: string | null } | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; email_confirmed_at?: string | null };
}

async function db(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(env, true), ...(init.headers ?? {}) },
  });
}

async function dbJson<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await db(env, path, init);
  if (!res.ok) throw new Error(`Database request failed (${res.status})`);
  return (await res.json()) as T;
}

async function deleteOldStorageFile(env: Env, path: string): Promise<void> {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/listing-images/${path}`, {
    method: 'DELETE',
    headers: supabaseHeaders(env, true),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
}

async function detectType(bytes: Uint8Array): Promise<'webp' | 'jpg' | null> {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

function contentType(ext: 'webp' | 'jpg'): string {
  return ext === 'webp' ? 'image/webp' : 'image/jpeg';
}

async function countUploads(env: Env, userId: string, since: string): Promise<number> {
  const rows = await dbJson<{ path: string }[]>(
    env,
    `uploads?select=path&user_id=eq.${encodeURIComponent(userId)}&created_at=gt.${encodeURIComponent(since)}&limit=121`,
  );
  return rows.length;
}

async function upload(req: Request, env: Env, user: { id: string }) {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return json({ error: 'That photo is too large.' }, 413);

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return json({ error: 'That photo is too large.' }, 413);

  const ext = await detectType(bytes);
  if (!ext) return json({ error: 'Only JPEG or WebP photos are accepted.' }, 415);

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [hour, day] = await Promise.all([
    countUploads(env, user.id, hourAgo),
    countUploads(env, user.id, dayAgo),
  ]);
  if (hour >= MAX_PER_HOUR || day >= MAX_PER_DAY) {
    return json({ error: 'You have uploaded a lot of photos recently. Please try again later.' }, 429);
  }

  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: contentType(ext),
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const storedPath = `r2/${key}`;
  const res = await db(env, 'uploads', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ path: storedPath, user_id: user.id, bytes: bytes.length }),
  });
  if (!res.ok) {
    await env.MEDIA.delete(key).catch(() => {});
    throw new Error('Could not record the upload.');
  }

  return json({ path: storedPath });
}

async function deleteFiles(req: Request, env: Env, user: { id: string }) {
  const body = (await req.json()) as { paths?: unknown };
  const paths = body.paths;
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > 12 ||
    !paths.every((p) => typeof p === 'string' && (OLD_PATH_RE.test(p) || R2_PATH_RE.test(p)))
  ) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const owned = await dbJson<{ path: string }[]>(
    env,
    `uploads?select=path&user_id=eq.${encodeURIComponent(user.id)}&path=in.(${paths.map((p) => encodeURIComponent(p)).join(',')})`,
  );

  let removed = 0;
  for (const row of owned) {
    const path = row.path;
    const used = await dbJson<{ id: string }[]>(
      env,
      `listings?select=id&images=cs.${encodeURIComponent(`{${path}}`)}&limit=1`,
    );
    if (used.length) continue;

    if (R2_PATH_RE.test(path)) {
      await env.MEDIA.delete(path.slice(3));
    } else {
      await deleteOldStorageFile(env, path);
    }

    await db(env, `uploads?path=eq.${encodeURIComponent(path)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    removed++;
  }
  return json({ removed });
}

async function deleteListing(req: Request, env: Env, user: { id: string }) {
  const body = (await req.json()) as { listingId?: unknown };
  if (typeof body.listingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.listingId)) {
    return json({ error: 'Invalid request.' }, 400);
  }

  const rows = await dbJson<{ id: string; seller_id: string; images: string[] }[]>(
    env,
    `listings?select=id,seller_id,images&id=eq.${encodeURIComponent(body.listingId)}&limit=1`,
  );
  const listing = rows[0];
  if (!listing || listing.seller_id !== user.id) return json({ error: 'Listing not found.' }, 404);

  for (const path of listing.images ?? []) {
    if (R2_PATH_RE.test(path)) {
      await env.MEDIA.delete(path.slice(3)).catch(() => {});
    } else if (OLD_PATH_RE.test(path)) {
      await deleteOldStorageFile(env, path).catch(() => {});
    }
    await db(env, `uploads?path=eq.${encodeURIComponent(path)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' });
  }

  const deleted = await db(env, `listings?id=eq.${encodeURIComponent(listing.id)}&seller_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE' });
  if (!deleted.ok) return json({ error: 'Could not delete the listing.' }, 500);
  return json({ deleted: true });
}

async function migrate(req: Request, env: Env) {
  if (!env.MEDIA_MIGRATION_SECRET || req.headers.get('x-media-migration-secret') !== env.MEDIA_MIGRATION_SECRET) {
    return json({ error: 'Not allowed.' }, 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '25') || 25, 1), 25);
  const rows = await dbJson<{ path: string; bytes: number }[]>(
    env,
    `uploads?select=path,bytes&path=not.like.r2/%26order=created_at.asc&limit=${limit}`,
  );

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!OLD_PATH_RE.test(row.path)) {
      skipped++;
      continue;
    }

    const source = await fetch(`${env.SUPABASE_URL}/storage/v1/object/listing-images/${row.path}`, {
      headers: supabaseHeaders(env, true),
    });
    if (!source.ok) throw new Error(`Could not read old image ${row.path} (${source.status})`);
    const bytes = await source.arrayBuffer();

    const type = row.path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    await env.MEDIA.put(row.path, bytes, {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });

    const listings = await dbJson<{ id: string; images: string[] }[]>(
      env,
      `listings?select=id,images&images=cs.${encodeURIComponent(`{${row.path}}`)}&limit=100`,
    );

    for (const listing of listings) {
      const images = (listing.images ?? []).map((p) => (p === row.path ? `r2/${row.path}` : p));
      await db(env, `listings?id=eq.${encodeURIComponent(listing.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ images }),
      });
    }

    await db(env, `uploads?path=eq.${encodeURIComponent(row.path)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ path: `r2/${row.path}` }),
    });

    migrated++;
  }

  return json({ migrated, skipped, remaining: rows.length === limit });
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
  const origin = context.request.headers.get('Origin') ?? '*';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Media-Migration-Secret',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const action = url.searchParams.get('action');
  const origin = context.request.headers.get('Origin') ?? undefined;

  try {
    if (action === 'migrate') return await migrate(context.request, context.env);

    const user = await requireUser(context.request, context.env);
    if (!user) return json({ error: 'Please sign in again.' }, 401, origin);
    if (!user.email_confirmed_at) return json({ error: 'Confirm your email address before uploading.' }, 403, origin);

    if (action === 'upload') return await upload(context.request, context.env, user);
    if (action === 'delete-files') return await deleteFiles(context.request, context.env, user);
    if (action === 'delete-listing') return await deleteListing(context.request, context.env, user);

    return json({ error: 'Unknown action.' }, 400, origin);
  } catch (err) {
    console.error('media error', action, err instanceof Error ? err.message : err);
    return json({ error: 'The photo service is unavailable right now. Please try again in a moment.' }, 502, origin);
  }
};
