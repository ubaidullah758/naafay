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

    // Attach active user context headers if not already provided
    const headers = new Headers(init?.headers || {});
    if (!headers.has('x-user-role')) {
      const activeRole = localStorage.getItem('naafay_active_role');
      if (activeRole) {
        headers.set('x-user-role', activeRole);
        if (activeRole === 'student') {
          try {
            const raw = localStorage.getItem('naafay_active_student_user');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.profileId) headers.set('x-user-id', parsed.profileId);
              if (parsed.studentId) headers.set('x-student-id', parsed.studentId);
            }
          } catch {}
        }
      }
    }
    const modifiedInit = { ...init, headers };

    // When deployed on static SPA hosts (like Vercel, Netlify, GitHub Pages) without a running Node backend:
    // Every POST/PUT/DELETE /api/* results in 405 Method Not Allowed and GET rewrites to index.html.
    // Seamlessly service the request with the client fallback.
    const isStaticDeploy =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('vercel.app') ||
        window.location.hostname.endsWith('github.io') ||
        window.location.hostname.endsWith('netlify.app'));

    if (isStaticDeploy) {
      return handleClientFallback(urlString, modifiedInit);
    }

    try {
      const response = await originalFetch(input, modifiedInit);
      const contentType = response.headers.get('content-type') || '';

      // If the server returned HTML (e.g., rewrite to index.html <!doctype ...>)
      // or 404 / 405 Method Not Allowed / 500+ error, switch to client fallback
      if (
        contentType.includes('text/html') ||
        response.status === 404 ||
        response.status === 405 ||
        response.status >= 500 ||
        (!response.ok && !contentType.includes('application/json'))
      ) {
        return handleClientFallback(urlString, modifiedInit);
      }

      return response;
    } catch {
      // Network error or backend offline — seamlessly fall back to local storage
      return handleClientFallback(urlString, modifiedInit);
    }
  };
}
