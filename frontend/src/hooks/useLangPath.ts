import { useTranslation } from 'react-i18next';
import type { Lang } from '../i18n';

export function useLangPath() {
  const { i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const prefix = lang === 'ko' ? '' : `/${lang}`;

  return (path: string) => `${prefix}${path}`;
}
