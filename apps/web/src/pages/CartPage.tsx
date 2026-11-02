import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@elsa3d/ui';
import { useCart } from '../cart.js';
import { useLocale } from '../i18n.js';

export default function CartPage() {
  const { t, locale, formatCurrency } = useLocale();
  const { items, subtotal, setQuantity, remove } = useCart();

  return (
    <main className="page-shell cart-page">
      <p className="section-heading__eyebrow">Namaa / نماء</p>
      <h1>{t('cartTitle')}</h1>
      {!items.length ? <section className="cart-empty"><span className="cart-empty__icon"><ShoppingBag size={26} aria-hidden="true" /></span><p>{t('emptyCart')}</p><Link className="button-link button-link--green" to="/products">{t('continueShopping')}</Link></section> : (
        <div className="cart-layout">
          <div className="cart-items">
            {items.map((item) => {
              const name = locale === 'ar' ? item.product.nameAr || item.product.name : item.product.name;
              return <article className="cart-item" key={item.variant.id}>
                <Link className="cart-item__image" to={`/products/${item.product.slug}`}>
                  {item.product.images?.[0] ? <img src={item.product.images[0].url} alt={item.product.images[0].altText || name} /> : <span aria-hidden="true">N</span>}
                </Link>
                <div className="cart-item__details"><Link to={`/products/${item.product.slug}`}><strong>{name}</strong></Link><span>{item.variant.name}</span><strong>{formatCurrency(item.variant.price)}</strong></div>
                <div className="cart-item__tools">
                  <div className="quantity-control"><button type="button" aria-label={t('decreaseQuantity')} onClick={() => setQuantity(item.variant.id, item.quantity - 1)}><Minus size={15} /></button><span>{item.quantity}</span><button type="button" aria-label={t('increaseQuantity')} onClick={() => setQuantity(item.variant.id, item.quantity + 1)}><Plus size={15} /></button></div>
                  <button type="button" className="icon-button cart-item__remove" aria-label={`${t('remove')} ${name}`} onClick={() => remove(item.variant.id)}><Trash2 size={17} /></button>
                </div>
              </article>;
            })}
          </div>
          <aside className="cart-summary"><h2>{t('orderSummary')}</h2><div><span>{t('cartSubtotal')}</span><strong>{formatCurrency(subtotal)}</strong></div><p>{t('checkoutComingSoon')}</p><Button size="large" disabled>{t('checkout')}</Button><Link to="/products">{t('continueShopping')}</Link></aside>
        </div>
      )}
    </main>
  );
}
