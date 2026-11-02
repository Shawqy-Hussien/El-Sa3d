import { ArrowUpLeft, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../api.js';
import { useLocale } from '../i18n.js';

export function ProductCard({ product }: { product: Product }) {
  const { locale, t, formatCurrency } = useLocale();
  const variant = product.variants[0];
  const image = product.images?.[0];
  const name = locale === 'ar' ? product.nameAr || product.name : product.name;
  const available = product.variants.some(
    (item) => (item.inventory?.quantity ?? 0) - (item.inventory?.reservedQuantity ?? 0) > 0,
  );

  return (
    <article className="product-card">
      <Link className="product-card__media" to={`/products/${product.slug}`} aria-label={name}>
        {image ? (
          <img src={image.url} alt={image.altText || name} loading="lazy" />
        ) : (
          <span className="product-card__placeholder" aria-hidden="true"><PackageOpen /></span>
        )}
        {product.prescriptionRequired ? (
          <span className="product-card__tag">{t('prescriptionRequired')}</span>
        ) : null}
      </Link>
      <div className="product-card__body">
        <p className="product-card__brand">{product.brand?.name ?? product.category?.name}</p>
        <Link className="product-card__name" to={`/products/${product.slug}`}>{name}</Link>
        <div className="product-card__bottom">
          <div>
            <strong>{variant ? formatCurrency(variant.price) : '—'}</strong>
            {variant?.compareAtPrice ? <del>{formatCurrency(variant.compareAtPrice)}</del> : null}
          </div>
          <span className={`stock-dot${available ? '' : ' stock-dot--out'}`} title={available ? t('available') : t('unavailable')} aria-label={available ? t('available') : t('unavailable')} />
        </div>
        <Link className="product-card__arrow" to={`/products/${product.slug}`} aria-label={t('productDetails')}>
          <ArrowUpLeft aria-hidden="true" size={17} />
        </Link>
      </div>
    </article>
  );
}
