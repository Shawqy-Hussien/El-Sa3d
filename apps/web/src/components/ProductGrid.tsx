import { ArrowLeft, ArrowRight, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@elsa3d/ui';
import type { Product } from '../api.js';
import { useLocale } from '../i18n.js';
import { ProductCard } from './ProductCard.js';

export function ProductGrid({
  products,
  loading = false,
  error,
  emptyMessage,
  onRetry,
}: {
  products: Product[];
  loading?: boolean;
  error?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
}) {
  const { t } = useLocale();
  if (loading) {
    return <div className="product-grid" aria-label={t('loading')}><Skeleton className="product-skeleton" lines={3} /><Skeleton className="product-skeleton" lines={3} /><Skeleton className="product-skeleton" lines={3} /></div>;
  }
  if (error) {
    return <div className="inline-state inline-state--error" role="alert"><CircleAlert /><span>{t('loadError')}</span>{onRetry ? <button type="button" onClick={onRetry}>{t('retry')}</button> : null}</div>;
  }
  if (!products.length) return <p className="empty-state">{emptyMessage ?? t('emptyProducts')}</p>;
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}

export function SectionHeading({
  title,
  to,
  linkLabel,
  eyebrow,
}: {
  title: string;
  to?: string;
  linkLabel?: string;
  eyebrow?: string;
}) {
  const { locale } = useLocale();
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <div className="section-heading">
      <div>{eyebrow ? <p className="section-heading__eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>
      {to && linkLabel ? <Link to={to} className="text-link">{linkLabel}<Arrow size={16} aria-hidden="true" /></Link> : null}
    </div>
  );
}
