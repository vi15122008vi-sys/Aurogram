export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const backendUrl = `http://31.77.67.106:8000${url.pathname}${url.search}`;
  
  const modifiedRequest = new Request(backendUrl, context.request);
  return fetch(modifiedRequest);
};
