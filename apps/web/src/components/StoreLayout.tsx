import { ArrowLeft, ArrowRight, Menu, ShoppingBag, Sprout, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api, type Category } from '../api.js';
import { useAuth } from '../auth.js';
import { useCart } from '../cart.js';
import { useLocale } from '../i18n.js';
import { Navigation } from '@elsa3d/ui';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { SearchBox } from './SearchBox.js';

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

export function StoreLayout() {
  const { t, locale, toggleLocale } = useLocale();
  const { count } = useCart();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.getCategories().then((result) => setCategories(result.items)).catch(() => setCategories([]));
  }, []);
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const allCategories = flattenCategories(categories).slice(0, 7);
  const Forward = locale === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="storefront">
      <a className="skip-link" href="#main-content">{locale === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}</a>
      <div className="service-ribbon">
        <span><span className="service-ribbon__dot" /> {t('deliveryTime')}</span>
        <span className="service-ribbon__message">{t('tagline')}</span>
        <span>{t('support')}</span>
      </div>
      <header className="site-header">
        <div className="site-header__main page-shell">
          <button
            type="button"
            className="icon-button mobile-menu-trigger"
            aria-label={menuOpen ? t('menuClose') : t('menuOpen')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link className="brand-lockup" to="/" aria-label="Namaa home">
            <span className="brand-lockup__mark"><Sprout size={24} strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="brand-lockup__text">
              <strong>Namaa</strong>
              <small>{t('tagline')}</small>
            </span>
          </Link>
          <div className="site-header__search"><SearchBox /></div>
          <div className="site-header__actions">
            <LanguageSwitcher />
            <button type="button" className="icon-button account-action" aria-label={t('account')} onClick={() => navigate(user ? '/account' : '/login')}>
              <UserRound size={20} aria-hidden="true" />
              <span>{t('account')}</span>
            </button>
            <button type="button" className="icon-button cart-action" aria-label={`${t('cart')} (${count})`} onClick={() => navigate('/cart')}>
              <ShoppingBag size={20} aria-hidden="true" />
              <span>{t('cart')}</span>
              {count > 0 ? <span className="cart-count" aria-hidden="true">{count}</span> : null}
            </button>
          </div>
          <div className="site-header__mobile-search"><SearchBox compact /></div>
        </div>
        <Navigation label={t('menu')} className={`category-nav${menuOpen ? ' category-nav--open' : ''}`}>
          <div className="page-shell category-nav__inner">
            <NavLink to="/products" end>{t('allProducts')}</NavLink>
            {allCategories.map((category) => (
              <NavLink key={category.id} to={`/products?category=${encodeURIComponent(category.slug)}`}>
                {category.name}
              </NavLink>
            ))}
            <NavLink to="/#offers" className="category-nav__offer">{t('offers')} <Forward size={14} /></NavLink>
          </div>
        </Navigation>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="page-shell site-footer__main">
          <div className="site-footer__brand">
            <Link className="brand-lockup brand-lockup--footer" to="/">
              <span className="brand-lockup__mark"><Sprout size={22} aria-hidden="true" /></span>
              <span className="brand-lockup__text"><strong>Namaa</strong><small>{t('tagline')}</small></span>
            </Link>
            <p>{t('footerNote')}</p>
          </div>
          <div className="site-footer__links">
            <Link to="/products">{t('allProducts')}</Link>
            <Link to="/#offers">{t('offers')}</Link>
            <Link to={user ? '/account' : '/login'}>{t('account')}</Link>
          </div>
          <p className="site-footer__service">{t('deliveryCopy')}</p>
        </div>
        <div className="page-shell site-footer__bottom"><span>© {new Date().getFullYear()} Namaa</span><button type="button" onClick={toggleLocale}>{t('language')}</button></div>
      </footer>
    </div>
  );
}
