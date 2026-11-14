import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations, TranslationKey } from '../i18n/translations';

interface LanguageContextValue {
  lang: Language;
  dir: 'rtl' | 'ltr';
  setLang: (l: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  pick: (en?: string | null, ur?: string | null) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('naafay_lang');
    return saved === 'en' ? 'en' : 'ur';
  });

  const dir: 'rtl' | 'ltr' = lang === 'ur' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem('naafay_lang', lang);
  }, [lang, dir]);

  const setLang = (l: Language) => setLangState(l);
  const toggleLang = () => setLangState((prev) => (prev === 'ur' ? 'en' : 'ur'));
  const t = (key: TranslationKey) => translations[lang][key] || translations.en[key];
  const pick = (en?: string | null, ur?: string | null) => {
    if (lang === 'ur') return ur || en || '';
    return en || ur || '';
  };

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang, toggleLang, t, pick }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
