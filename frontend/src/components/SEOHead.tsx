import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, LANG_META, type Lang } from '../i18n';

const BASE_URL = 'https://wakalab.com';

interface SEOHeadProps {
  page: 'landing' | 'analyze' | 'contact' | 'dashboard' | 'demo';
}

function langPath(lang: Lang): string {
  return lang === 'ko' ? '' : `/${lang}`;
}

export default function SEOHead({ page }: SEOHeadProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const locale = LANG_META[lang]?.locale ?? 'ko_KR';

  const title = t(`seo.${page}.title`);
  const description = t(`seo.${page}.description`);

  const pathMap: Record<string, string> = {
    landing: '',
    analyze: '/analyze',
    contact: '/contact',
    dashboard: '/dashboard',
    demo: '/demo',
  };
  const pagePath = pathMap[page] ?? '';
  const canonical = `${BASE_URL}${langPath(lang)}${pagePath}`;

  const jsonLd =
    page === 'landing'
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'CRABs Inc.',
            alternateName: '(주)크랩스',
            url: BASE_URL,
            logo: `${BASE_URL}/logo.png`,
            sameAs: [],
            contactPoint: {
              '@type': 'ContactPoint',
              email: 'contact@crabs.ai',
              contactType: 'customer service',
              availableLanguage: ['Korean', 'English', 'Japanese'],
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'WakaLab',
            url: BASE_URL,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            description: t('seo.landing.description'),
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'KRW',
            },
            creator: {
              '@type': 'Organization',
              name: 'CRABs Inc.',
            },
          },
        ]
      : [];

  return (
    <Helmet>
      <html lang={lang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="WakaLab" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${BASE_URL}/og-image.png`} />
      <meta property="og:locale" content={locale} />
      {SUPPORTED_LANGS.filter((l) => l !== lang).map((l) => (
        <meta
          key={l}
          property="og:locale:alternate"
          content={LANG_META[l].locale}
        />
      ))}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${BASE_URL}/og-image.png`} />

      {/* hreflang — GEO */}
      {SUPPORTED_LANGS.map((l) => (
        <link
          key={l}
          rel="alternate"
          hrefLang={l}
          href={`${BASE_URL}${langPath(l)}${pagePath}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${BASE_URL}${pagePath}`}
      />

      {/* JSON-LD Structured Data */}
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}
