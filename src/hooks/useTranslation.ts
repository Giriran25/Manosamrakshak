import { useCallback } from 'react';
import { en, type TranslationKey } from '@/i18n/en';

export interface Translation {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  fontClass: string;
}

export const useTranslation = (): Translation => {
  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    const value = en[key] as string;
    if (!params) return value;
    return Object.entries(params).reduce(
      (copy, [name, replacement]) => copy.replaceAll(`{${name}}`, String(replacement)),
      value,
    );
  }, []);

  return { t, fontClass: '' };
};
