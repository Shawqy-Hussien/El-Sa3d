import { Languages } from 'lucide-react';
import { useLocale } from '../i18n.js';

export function LanguageSwitcher() {
  const { t, toggleLocale } = useLocale();
  return (
    <button type="button" className="language-switch" onClick={toggleLocale} aria-label={t('languageLabel')}>
      <Languages size={18} aria-hidden="true" />
      <span>{t('language')}</span>
    </button>
  );
}
