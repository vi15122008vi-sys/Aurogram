export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const backendUrl = `http://31.77.67.106:8000${url.pathname}${url.search}`;

  const targetRequest = new Request(backendUrl, context.request);
  const headers = new Headers(targetRequest.headers);
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  headers.set(
    "Accept",
    targetRequest.headers.get("Accept") ?? "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  );

  const proxyRequest = new Request(targetRequest, { headers, redirect: "manual" });
  return fetch(proxyRequest);
};
