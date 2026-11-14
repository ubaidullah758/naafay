export interface SeoConfig {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function applySeoMetadata(config: SeoConfig) {
  const origin = window.location.origin;
  const canonicalUrl = `${origin}${config.path.startsWith('/') ? config.path : `/${config.path}`}`;

  document.title = config.title;
  upsertMeta('name', 'description', config.description);
  upsertMeta('name', 'robots', config.noindex ? 'noindex,nofollow' : 'index,follow');
  upsertMeta('property', 'og:title', config.title);
  upsertMeta('property', 'og:description', config.description);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('name', 'twitter:title', config.title);
  upsertMeta('name', 'twitter:description', config.description);

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  const existingLd = document.getElementById('naafay-seo-jsonld');
  if (config.jsonLd) {
    let script = existingLd as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'naafay-seo-jsonld';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(config.jsonLd);
  } else if (existingLd) {
    existingLd.remove();
  }
}
