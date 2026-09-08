import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { setPortalLanguage } from '../i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language === 'ha' ? 'ha' : 'en';

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-600">
      <Languages size={14} className="text-slate-400" />
      <button
        onClick={() => setPortalLanguage('en')}
        className={current === 'en' ? 'text-brand-700' : 'text-slate-400'}
        aria-label={t('partnerPortal.language.en')}
      >
        EN
      </button>
      <span className="text-slate-300">/</span>
      <button
        onClick={() => setPortalLanguage('ha')}
        className={current === 'ha' ? 'text-brand-700' : 'text-slate-400'}
        aria-label={t('partnerPortal.language.ha')}
      >
        HA
      </button>
    </div>
  );
}
