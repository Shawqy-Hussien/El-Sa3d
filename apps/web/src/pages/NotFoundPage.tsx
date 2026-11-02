import { Link } from 'react-router-dom';
import { useLocale } from '../i18n.js';

export default function NotFoundPage() {
  const { t } = useLocale();
  return <main className="page-shell not-found"><span>404</span><h1>{t('pageNotFound')}</h1><Link to="/">{t('home')}</Link></main>;
}
