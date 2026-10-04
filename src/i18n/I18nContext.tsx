import React, { createContext, useContext, useState, ReactNode } from "react";
import { translations, Language } from "./translations";

type TranslationKeys = keyof typeof translations.pt;
type SubKeys<T extends TranslationKeys> = keyof typeof translations.pt[T];

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: <T extends TranslationKeys>(section: T, key: SubKeys<T>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>("pt");

  const t = <T extends TranslationKeys>(section: T, key: SubKeys<T>): string => {
    return translations[language][section][key] as unknown as string;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
