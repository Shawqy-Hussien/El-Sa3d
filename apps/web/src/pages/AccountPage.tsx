import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@elsa3d/ui';
import { useAuth } from '../auth.js';
import { useLocale } from '../i18n.js';

export default function AccountPage() {
  const { t } = useLocale();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  if (!user) return <main className="page-shell account-page"><section className="account-gate"><h1>{t('accountTitle')}</h1><p>{t('accountLoginPrompt')}</p><Link className="button-link button-link--green" to="/login">{t('login')}</Link></section></main>;

  async function logout() {
    setBusy(true);
    try {
      await signOut();
      navigate('/');
    } finally {
      setBusy(false);
    }
  }

  const tab = location.pathname.split('/')[2] ?? 'profile';
  return (
    <main className="page-shell account-page">
      <p className="section-heading__eyebrow">Namaa / نماء</p>
      <div className="account-heading"><div><h1>{t('accountTitle')}</h1><p>{user.email}</p></div><Button variant="secondary" loading={busy} onClick={() => void logout()}>{t('signOut')}</Button></div>
      <div className="account-layout">
        <nav className="account-nav" aria-label={t('accountNavigation')}>
          <Link className={tab === 'profile' ? 'is-active' : ''} to="/account/profile">{t('profile')}</Link>
          <Link className={tab === 'orders' ? 'is-active' : ''} to="/account/orders">{t('orders')}</Link>
          <Link className={tab === 'prescriptions' ? 'is-active' : ''} to="/account/prescriptions">{t('prescriptions')}</Link>
        </nav>
        <section className="account-content"><h2>{tab === 'orders' ? t('orders') : tab === 'prescriptions' ? t('prescriptions') : t('profile')}</h2><p>{t('accountShell')}</p>{tab === 'profile' ? <dl><div><dt>{t('email')}</dt><dd>{user.email}</dd></div><div><dt>{t('accountRole')}</dt><dd>{user.role}</dd></div></dl> : null}</section>
      </div>
    </main>
  );
}
