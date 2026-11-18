import { renderPublicPage } from './ssr/render';

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface Context {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}

export async function onRequest(context: Context): Promise<Response> {
  const url = new URL(context.request.url);
  if (url.hostname.toLowerCase() === 'mauamarketplace.pages.dev') {
    url.hostname = 'mauamarketplace.eu.cc';
    return Response.redirect(url.toString(), 301);
  }
  if (context.request.method !== 'GET') return context.next();
  const response = await context.next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (!['/', '/categories', '/safety', '/rules', '/privacy', '/terms', '/refund-policy'].includes(path)
    && !path.startsWith('/category/') && !path.startsWith('/listing/')) return response;
  try {
    const html = await response.text();
    return await renderPublicPage(path, html, context.env) || new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('Maua public-page HTML rendering failed; serving the original app shell.', error);
    return response;
  }
}
