import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

export const SUPPORTED_LANGS = ['ko', 'en', 'ja'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_META: Record<Lang, { flag: string; label: string; locale: string }> = {
  ko: { flag: '\uD83C\uDDF0\uD83C\uDDF7', label: '\uD55C\uAD6D\uC5B4', locale: 'ko_KR' },
  en: { flag: '\uD83C\uDDFA\uD83C\uDDF8', label: 'English', locale: 'en_US' },
  ja: { flag: '\uD83C\uDDEF\uD83C\uDDF5', label: '\u65E5\u672C\u8A9E', locale: 'ja_JP' },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja },
    },
    fallbackLng: 'ko',
    supportedLngs: ['ko', 'en', 'ja'],
    detection: {
      order: ['path', 'navigator'],
      lookupFromPathIndex: 0,
      caches: [],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
