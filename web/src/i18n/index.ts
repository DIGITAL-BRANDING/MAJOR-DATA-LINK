import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import ha from './locales/ha';

const STORAGE_KEY = 'mdl_partner_portal_lang';

function initialLanguage(): 'en' | 'ha' {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'ha' ? 'ha' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ha: { translation: ha } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

/** Switches language and remembers the choice for next visit - called from LanguageSwitcher. */
export function setPortalLanguage(lang: 'en' | 'ha') {
  localStorage.setItem(STORAGE_KEY, lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
