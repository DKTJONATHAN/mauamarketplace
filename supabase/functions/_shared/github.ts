// Commits and removes listing photos in the media branch of the GitHub repository.
// The GitHub token lives only in Supabase secrets (GH_MEDIA_TOKEN) and never reaches the browser.

const OWNER = Deno.env.get('GH_OWNER') ?? 'DKTJONATHAN';
const REPO = Deno.env.get('GH_REPO') ?? 'mauamarketplace';
const BRANCH = Deno.env.get('GH_MEDIA_BRANCH') ?? 'media';
const TOKEN = Deno.env.get('GH_MEDIA_TOKEN') ?? '';

let branchReady = false;

function gh(path: string, init: RequestInit = {}): Promise<Response> {
  if (!TOKEN) throw new Error('GH_MEDIA_TOKEN is not configured');
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mauamarketplace-media',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Creates the media branch from the default branch the first time it is needed. */
export async function ensureBranch(): Promise<void> {
  if (branchReady) return;
  const existing = await gh(`/git/ref/heads/${BRANCH}`);
  if (existing.ok) {
    branchReady = true;
    return;
  }
  if (existing.status !== 404) throw new Error(`GitHub branch check failed (${existing.status})`);

  const repo = await gh('');
  if (!repo.ok) throw new Error(`GitHub repository lookup failed (${repo.status})`);
  const { default_branch } = (await repo.json()) as { default_branch: string };
  const base = await gh(`/git/ref/heads/${default_branch}`);
  if (!base.ok) throw new Error(`GitHub default branch lookup failed (${base.status})`);
  const { object } = (await base.json()) as { object: { sha: string } };

  const created = await gh('/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: object.sha }),
  });
  // 422 means another request created it first, which is fine.
  if (!created.ok && created.status !== 422) throw new Error(`Could not create media branch (${created.status})`);
  branchReady = true;
}

/** Commits one file. Retries because simultaneous commits to one branch can conflict. */
export async function putFile(path: string, bytes: Uint8Array, message: string): Promise<void> {
  await ensureBranch();
  const content = toBase64(bytes);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await gh(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content, branch: BRANCH }),
    });
    if (res.ok) return;
    lastStatus = res.status;
    const retryable = res.status === 409 || res.status === 422 || res.status === 429 || res.status >= 500 || res.status === 403;
    if (!retryable) break;
    await sleep(300 * (attempt + 1) + Math.random() * 400);
  }
  throw new Error(`GitHub rejected the upload (${lastStatus})`);
}

/** Deletes one file. A file that is already gone counts as success. */
export async function deleteFile(path: string, message: string): Promise<void> {
  await ensureBranch();
  for (let attempt = 0; attempt < 5; attempt++) {
    const info = await gh(`/contents/${path}?ref=${BRANCH}`);
    if (info.status === 404) return;
    if (!info.ok) throw new Error(`GitHub lookup failed (${info.status})`);
    const { sha } = (await info.json()) as { sha: string };
    const res = await gh(`/contents/${path}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: BRANCH }),
    });
    if (res.ok || res.status === 404) return;
    if (res.status !== 409 && res.status !== 422 && res.status < 500) throw new Error(`GitHub delete failed (${res.status})`);
    await sleep(300 * (attempt + 1) + Math.random() * 400);
  }
  throw new Error('GitHub delete kept conflicting');
}
