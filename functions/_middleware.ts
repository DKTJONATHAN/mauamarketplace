/**
 * Canonical-host redirect for the Cloudflare Pages preview hostname.
 * Preserve the full path and query string while consolidating the public origin.
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);

  if (url.hostname.toLowerCase() === "mauamarketplace.pages.dev") {
    url.hostname = "mauamarketplace.eu.cc";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
