export const onRequest: PagesFunction = async (context) => {
  const incomingUrl = new URL(context.request.url);
  console.log("[api-proxy] incoming request", {
    url: incomingUrl.toString(),
    method: context.request.method,
  });
  const backendUrl = `http://31.77.67.106:8000${incomingUrl.pathname}${incomingUrl.search}`;

  // Forward preflight requests too so the backend can return its CORS policy.
  const headers = new Headers(context.request.headers);
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  );
  headers.set(
    "Accept",
    context.request.headers.get("Accept") ?? "*/*",
  );

  const proxyRequest = new Request(backendUrl, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });
  return fetch(proxyRequest);
};
