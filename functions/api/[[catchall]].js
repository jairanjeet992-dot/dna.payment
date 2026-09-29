// Cloudflare Pages Edge Function Proxy to Render Backend
// Automatically forwards any /api/* request made on https://dna-payments.pages.dev to Render

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetUrl = 'https://dna-payment.onrender.com' + url.pathname + url.search;

  // Forward request with original method, headers, and body
  const modifiedRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: context.request.headers,
    body: (context.request.method === 'GET' || context.request.method === 'HEAD') ? null : context.request.body,
    redirect: 'follow'
  });

  return fetch(modifiedRequest);
}
