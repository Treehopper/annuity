import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import de from './de.json';
import en from './en.json';

export type AppLanguage = 'de' | 'en';

/** 'system': German if the OS language is de-* (incl. de-AT, de-CH), otherwise English (D4, DL-21). */
export function resolveLanguage(setting: 'system' | 'de' | 'en'): AppLanguage {
  if (setting !== 'system') return setting;
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code.toLowerCase() === 'de' ? 'de' : 'en';
}

/** Locale used for number and date formatting: follows the resolved app language. */
export function formatLocale(lang: AppLanguage): string {
  return lang === 'de' ? 'de-DE' : 'en';
}

// eslint-disable-next-line import/no-named-as-default-member -- the instance API is the documented setup
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng: resolveLanguage('system'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
