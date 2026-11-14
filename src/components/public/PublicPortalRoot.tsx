import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PublicPortalLayout, PublicRoute } from './PublicPortalLayout';
import { PublicHomeView } from './PublicHomeView';
import { PublicAskView } from './PublicAskView';
import { PublicTrackView } from './PublicTrackView';
import { PublicLibraryView } from './PublicLibraryView';
import { PublicFatwaDetailView } from './PublicFatwaDetailView';
import { applySeoMetadata } from '../../lib/seo';
import { useLanguage } from '../../context/LanguageContext';
import { ErrorState } from '../ErrorState';
import { NotFound } from '../NotFound';

interface PublicPortalRootProps {
  onOpenStaffPortal: () => void;
}

export function parsePublicRoute(pathname: string): PublicRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return { page: 'home' };
  if (clean === '/ask') return { page: 'ask' };
  if (clean === '/track') return { page: 'track' };
  if (clean === '/fatwas') return { page: 'library' };
  if (clean.startsWith('/category/')) {
    const code = decodeURIComponent(clean.slice('/category/'.length));
    return { page: 'library', categoryCode: code };
  }
  if (clean.startsWith('/fatwa/')) {
    const id = decodeURIComponent(clean.slice('/fatwa/'.length));
    return { page: 'fatwa_detail', identifier: id };
  }
  return { page: 'not_found' };
}

function routeToPath(r: PublicRoute): string {
  switch (r.page) {
    case 'ask':
      return '/ask';
    case 'track':
      return '/track';
    case 'library':
      return r.categoryCode ? `/category/${encodeURIComponent(r.categoryCode)}` : '/fatwas';
    case 'fatwa_detail':
      return `/fatwa/${encodeURIComponent(r.identifier)}`;
    default:
      return '/';
  }
}

export const PublicPortalRoot: React.FC<PublicPortalRootProps> = ({ onOpenStaffPortal }) => {
  const { lang, pick } = useLanguage();
  const location = useLocation();
  const nav = useNavigate();

  // URL owns the page; navigation-only extras (search text, tracking code) ride
  // along in history state so they survive back/forward without polluting URLs.
  const route = useMemo<PublicRoute>(() => {
    const parsed = parsePublicRoute(location.pathname);
    const state = (location.state || {}) as { initialQuery?: string; trackingNumber?: string; verificationCode?: string };
    if (parsed.page === 'library') return { ...parsed, initialQuery: state.initialQuery };
    if (parsed.page === 'track') {
      return { ...parsed, trackingNumber: state.trackingNumber, verificationCode: state.verificationCode };
    }
    return parsed;
  }, [location.pathname, location.state]);

  const [portalData, setPortalData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [loadedFatwa, setLoadedFatwa] = useState<any | null>(null);

  const loadPortalData = React.useCallback(() => {
    setLoading(true);
    setPortalError(null);
    fetch('/api/public/portal-data')
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((data) => setPortalData(data))
      .catch((err: any) => setPortalError(err?.message || 'Failed to load portal data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const navigate = (next: PublicRoute) => {
    const state =
      next.page === 'library' && next.initialQuery
        ? { initialQuery: next.initialQuery }
        : next.page === 'track'
          ? { trackingNumber: next.trackingNumber, verificationCode: next.verificationCode }
          : null;
    nav(routeToPath(next), { state });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update SEO metadata + Schema.org JSON-LD per route
  useEffect(() => {
    const path = routeToPath(route);
    if (route.page === 'not_found') {
      applySeoMetadata({
        title: lang === 'ur' ? 'صفحہ نہیں ملا | نافع دارالافتاء' : 'Page Not Found | Naafay Dar-ul-Ifta',
        description: 'The requested page could not be found.',
        path: '/404',
        noindex: true,
      });
    } else if (route.page === 'ask') {
      applySeoMetadata({
        title: lang === 'ur' ? 'آن لائن استفتاء | نافع دارالافتاء' : 'Ask an Islamic Question | Naafay Dar-ul-Ifta',
        description:
          lang === 'ur'
            ? 'اپنا شرعی سوال براہِ راست نافع دارالافتاء کے مفتیانِ کرام کو ارسال کریں اور ٹریکنگ نمبر حاصل کریں۔'
            : 'Submit your Shariah question directly to Naafay Dar-ul-Ifta without creating an account and receive a private tracking number.',
        path,
      });
    } else if (route.page === 'track') {
      applySeoMetadata({
        title: lang === 'ur' ? 'سوال ٹریکنگ | نافع دارالافتاء' : 'Track Your Question | Naafay Dar-ul-Ifta',
        description: 'Securely track your submitted Fatwa question progress.',
        path,
        noindex: true, // Never index private tracking routes
      });
    } else if (route.page === 'library') {
      const catObj = (portalData?.categories || []).find(
        (c: any) => c.code?.toUpperCase() === route.categoryCode?.toUpperCase()
      );
      const catName = catObj ? pick(catObj.name_en, catObj.name_ur) : '';
      applySeoMetadata({
        title: catName
          ? `${catName} | ${lang === 'ur' ? 'نافع دارالافتاء' : 'Naafay Dar-ul-Ifta'}`
          : lang === 'ur'
            ? 'شائع شدہ فتاویٰ لائبریری | نافع دارالافتاء'
            : 'Published Fatawa Library | Naafay Dar-ul-Ifta',
        description:
          lang === 'ur'
            ? 'نافع دارالافتاء سے شائع شدہ مستند فتاویٰ اور شرعی احکامات تلاش کریں اور پڑھیں۔'
            : 'Search and read officially approved and published Fatawa from Naafay Dar-ul-Ifta.',
        path,
      });
    } else if (route.page === 'fatwa_detail' && loadedFatwa) {
      const titleText = pick(loadedFatwa.public_title_en, loadedFatwa.public_title_ur);
      applySeoMetadata({
        title: `${loadedFatwa.issued_fatwa_number} — ${titleText}`.slice(0, 65),
        description: String(loadedFatwa.public_question_text || '').slice(0, 155),
        path,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'QAPage',
          mainEntity: {
            '@type': 'Question',
            name: titleText,
            text: loadedFatwa.public_question_text,
            dateCreated: loadedFatwa.question_date,
            acceptedAnswer: {
              '@type': 'Answer',
              text: loadedFatwa.public_answer_text,
              dateCreated: (loadedFatwa.issued_at || '').slice(0, 10),
              author: {
                '@type': 'Organization',
                name: 'Naafay Dar-ul-Ifta',
              },
            },
          },
        },
      });
    } else {
      applySeoMetadata({
        title: lang === 'ur' ? 'نافع دارالافتاء | آن لائن فتاویٰ و شرعی رہنمائی' : 'Naafay Dar-ul-Ifta – Online Fatwa & Shariah Guidance',
        description:
          'Submit Islamic questions online, track your inquiry privately, and search officially published Fatawa from Naafay Dar-ul-Ifta.',
        path: '/',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Naafay Dar-ul-Ifta',
          url: window.location.origin,
          email: portalData?.settings?.contact_email || 'ifta@naafay.edu.pk',
        },
      });
    }
  }, [route, lang, portalData, loadedFatwa]);

  return (
    <PublicPortalLayout
      route={route}
      onNavigate={navigate}
      onOpenStaffPortal={onOpenStaffPortal}
      settings={portalData?.settings}
    >
      {portalError && !loading && (
        <div className="mb-4">
          <ErrorState message={portalError} compact onRetry={loadPortalData} />
        </div>
      )}
      {route.page === 'home' && (
        <PublicHomeView portalData={portalData} loading={loading} onNavigate={navigate} />
      )}
      {route.page === 'ask' && (
        <PublicAskView
          categories={portalData?.categories || []}
          allowOptionalEmail={portalData?.settings?.allow_optional_email ?? true}
          onNavigate={navigate}
        />
      )}
      {route.page === 'track' && (
        <PublicTrackView
          initialTrackingNumber={route.trackingNumber}
          initialVerificationCode={route.verificationCode}
          onNavigate={navigate}
        />
      )}
      {route.page === 'library' && (
        <PublicLibraryView
          categories={portalData?.categories || []}
          initialCategoryCode={route.categoryCode}
          initialQuery={route.initialQuery}
          onNavigate={navigate}
        />
      )}
      {route.page === 'fatwa_detail' && (
        <PublicFatwaDetailView
          identifier={route.identifier}
          onBack={() => navigate({ page: 'library' })}
          onLoadedTitle={(f) => setLoadedFatwa(f)}
        />
      )}
      {route.page === 'not_found' && (
        <NotFound
          onGoHome={() => navigate({ page: 'home' })}
          onGoBack={() => nav(-1)}
        />
      )}
    </PublicPortalLayout>
  );
};
