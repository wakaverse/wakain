import { useEffect } from 'react';
import { useParams, Outlet, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, type Lang } from '../i18n';

export default function LangSync() {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();

  const resolved: Lang =
    lang && SUPPORTED_LANGS.includes(lang as Lang) ? (lang as Lang) : 'ko';

  // Redirect invalid lang prefixes (e.g. /fr/analyze → /analyze)
  if (lang && !SUPPORTED_LANGS.includes(lang as Lang)) {
    return <Navigate to={`/${lang}`} replace />;
  }

  useEffect(() => {
    if (i18n.language !== resolved) {
      i18n.changeLanguage(resolved);
    }
  }, [resolved, i18n]);

  return <Outlet />;
}
