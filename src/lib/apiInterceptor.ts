import { handleClientFallback } from './clientFallback';

export function installApiInterceptor() {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept /api/ requests
    const isApi = urlString.includes('/api/') || urlString.startsWith('/api/');

    if (!isApi) {
      return originalFetch(input, init);
    }

    try {
      const response = await originalFetch(input, init);
      const contentType = response.headers.get('content-type') || '';

      // If the server returned HTML (e.g., Vercel rewrote /api to index.html <!doctype ...>)
      // or a 404 / 502+ error, switch to client-side localStorage fallback
      if (contentType.includes('text/html') || response.status === 404 || response.status >= 502) {
        return handleClientFallback(urlString, init);
      }

      return response;
    } catch {
      // Network error or backend offline — seamlessly fall back to local storage
      return handleClientFallback(urlString, init);
    }
  };
}
