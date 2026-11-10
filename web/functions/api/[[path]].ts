export const onRequest: PagesFunction = async (context) => {
  const incomingUrl = new URL(context.request.url);
  console.log("[api-proxy] incoming request", {
    url: incomingUrl.toString(),
    method: context.request.method,
  });

  if (context.request.method === "OPTIONS") {
    const requestedHeaders = context.request.headers.get("Access-Control-Request-Headers") ?? "Authorization, Content-Type, X-Auth-Token, X-Admin-Action-Token";
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://aurogram.pages.dev",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": requestedHeaders,
        "Access-Control-Max-Age": "86400",
        Vary: "Origin, Access-Control-Request-Headers",
      },
    });
  }

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
