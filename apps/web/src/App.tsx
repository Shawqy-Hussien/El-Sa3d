import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Skeleton } from '@elsa3d/ui';
import { AuthProvider } from './auth.js';
import { CartProvider } from './cart.js';
import { LocaleProvider, useLocale } from './i18n.js';
import { StoreLayout } from './components/StoreLayout.js';
import { ToastProvider } from './toast.js';

const HomePage = lazy(() => import('./pages/HomePage.js'));
const ProductListPage = lazy(() => import('./pages/ProductListPage.js'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage.js'));
const SearchPage = lazy(() => import('./pages/SearchPage.js'));
const AuthPage = lazy(() => import('./pages/AuthPage.js'));
const AccountPage = lazy(() => import('./pages/AccountPage.js'));
const CartPage = lazy(() => import('./pages/CartPage.js'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js'));

function RouteLoading() {
  const { t } = useLocale();
  return (
    <main className="page-shell route-loading" aria-label={t('loading')}>
      <Skeleton className="skeleton-heading" />
      <Skeleton className="skeleton-row" lines={3} />
    </main>
  );
}

function StoreRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:productId" element={<ProductDetailPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="account/*" element={<AccountPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
            <Route path="reset-password" element={<AuthPage mode="reset" />} />
            <Route path="verify-email" element={<AuthPage mode="verify" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <StoreRoutes />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
