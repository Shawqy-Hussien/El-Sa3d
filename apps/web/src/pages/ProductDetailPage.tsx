import { ArrowLeft, ArrowRight, Check, PackageOpen, Plus, Minus, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Skeleton } from '@elsa3d/ui';
import { api, type Product } from '../api.js';
import { useCart } from '../cart.js';
import { useLocale } from '../i18n.js';
import { useToast } from '../toast.js';
import { ProductGrid, SectionHeading } from '../components/ProductGrid.js';

export default function ProductDetailPage() {
  const { productId = '' } = useParams();
  const { t, locale, formatCurrency } = useLocale();
  const { add } = useCart();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    api.getProduct(productId).then(async (result) => {
      if (!mounted) return;
      setProduct(result);
      setVariantId(result.variants[0]?.id ?? '');
      if (result.category?.id) {
        const relatedResult = await api.getProducts(new URLSearchParams({ category: result.category.id, page: '1', pageSize: '4', sort: 'best_selling' }));
        if (mounted) setRelated(relatedResult.items.filter((item) => item.id !== result.id));
      }
    }).catch(() => { if (mounted) setError(true); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [productId]);

  const variant = product?.variants.find((item) => item.id === variantId);
  const available = Math.max(0, (variant?.inventory?.quantity ?? 0) - (variant?.inventory?.reservedQuantity ?? 0));
  const productName = useMemo(() => product ? (locale === 'ar' ? product.nameAr || product.name : product.name) : '', [product, locale]);
  const Forward = locale === 'ar' ? ArrowLeft : ArrowRight;

  if (loading) return <main className="page-shell product-detail-loading"><Skeleton className="detail-image-skeleton" /><Skeleton className="detail-copy-skeleton" lines={5} /></main>;
  if (error || !product) return <main className="page-shell page-error" role="alert"><h1>{t('productUnavailable')}</h1><p>{t('loadError')}</p><Link className="button-link button-link--green" to="/products">{t('allProducts')}</Link></main>;

  const images = product.images ?? [];
  const activeImage = images[imageIndex] ?? images[0];

  function addProduct() {
    if (!variant || available <= 0) return;
    add(product!, variant, quantity);
    toast({ title: t('addedToCart'), kind: 'success' });
  }

  return (
    <div className="page-shell product-detail-page">
      <nav className="breadcrumbs" aria-label={t('breadcrumbs')}><Link to="/">{t('home')}</Link><span>/</span><Link to="/products">{t('allProducts')}</Link><span>/</span><span aria-current="page">{productName}</span></nav>
      <section className="product-detail">
        <div className="product-gallery">
          <div className="product-gallery__main">
            {activeImage ? <img src={activeImage.url} alt={activeImage.altText || productName} /> : <div className="product-gallery__placeholder"><PackageOpen size={52} aria-hidden="true" /></div>}
            {images.length > 1 ? <div className="product-gallery__count">{String(imageIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</div> : null}
          </div>
          {images.length > 1 ? <div className="product-gallery__thumbs">{images.map((image, index) => <button key={image.id} type="button" className={index === imageIndex ? 'is-selected' : ''} onClick={() => setImageIndex(index)} aria-label={`${t('image')} ${index + 1}`}><img src={image.url} alt="" /></button>)}</div> : null}
        </div>
        <div className="product-detail__copy">
          <p className="product-detail__brand">{product.brand?.name ?? product.category?.name}</p>
          <h1>{productName}</h1>
          <p className="product-detail__description">{product.description}</p>
          {product.prescriptionRequired ? <p className="prescription-notice"><ShieldCheck size={18} />{t('prescriptionRequired')}</p> : null}
          <div className="product-detail__price">
            <strong>{variant ? formatCurrency(variant.price) : '—'}</strong>
            {variant?.compareAtPrice ? <del>{formatCurrency(variant.compareAtPrice)}</del> : null}
            {available > 0 ? <span className="availability"><Check size={15} />{t('available')}</span> : <span className="availability availability--out">{t('unavailable')}</span>}
          </div>
          {product.variants.length > 1 ? <fieldset className="variant-picker"><legend>{t('chooseVariant')}</legend><div>{product.variants.map((item) => <button type="button" key={item.id} className={item.id === variantId ? 'is-selected' : ''} onClick={() => { setVariantId(item.id); setQuantity(1); }}>{item.name}<small>{formatCurrency(item.price)}</small></button>)}</div></fieldset> : variant ? <p className="variant-single">{variant.name}</p> : null}
          <div className="purchase-row">
            <div className="quantity-control" aria-label={t('quantity')}>
              <button type="button" aria-label={t('decreaseQuantity')} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16} /></button>
              <input aria-label={t('quantity')} type="number" min="1" max={Math.max(available, 1)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(available || 99, Number(event.target.value) || 1)))} />
              <button type="button" aria-label={t('increaseQuantity')} onClick={() => setQuantity((value) => Math.min(available || 99, value + 1))}><Plus size={16} /></button>
            </div>
            <Button size="large" disabled={!variant || available <= 0} onClick={addProduct}>{t('addToCart')}<Forward size={18} aria-hidden="true" /></Button>
          </div>
          <div className="product-detail__assurance"><ShieldCheck size={18} /><span>{t('authenticityNote')}</span></div>
          <Link className="product-detail__category" to={`/products?category=${encodeURIComponent(product.category?.slug ?? product.category?.id ?? '')}`}>{t('category')}: {product.category?.name}</Link>
        </div>
      </section>
      <section className="section-block related-section"><SectionHeading title={t('relatedProducts')} to="/products" linkLabel={t('viewAll')} /><ProductGrid products={related} emptyMessage={t('emptyProducts')} /></section>
    </div>
  );
}
