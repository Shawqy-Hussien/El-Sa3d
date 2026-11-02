import { ArrowDownLeft, ArrowLeft, ArrowRight, BadgePercent, HeartPulse, Leaf, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Skeleton } from '@elsa3d/ui';
import { api, type Brand, type Category, type Offer, type Product, type StorefrontBanner } from '../api.js';
import { useAuth } from '../auth.js';
import { useLocale } from '../i18n.js';
import { useToast } from '../toast.js';
import { ProductGrid, SectionHeading } from '../components/ProductGrid.js';

interface HomeData {
  banners: StorefrontBanner[];
  offers: Offer[];
  categories: Category[];
  brands: Brand[];
  bestSellers: Product[];
  newArrivals: Product[];
}

const emptyData: HomeData = { banners: [], offers: [], categories: [], brands: [], bestSellers: [], newArrivals: [] };

export default function HomePage() {
  const { t, locale, formatCurrency } = useLocale();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<HomeData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeBanner, setActiveBanner] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    const [content, categories, brands, best, newest] = await Promise.allSettled([
      api.getStorefrontContent(),
      api.getCategories(),
      api.getBrands(),
      api.getProducts(new URLSearchParams({ page: '1', pageSize: '4', sort: 'best_selling' })),
      api.getProducts(new URLSearchParams({ page: '1', pageSize: '4', sort: 'newest' })),
    ]);
    if ([content, categories, brands, best, newest].every((item) => item.status === 'rejected')) {
      setError(true);
      setLoading(false);
      return;
    }
    setData({
      banners: content.status === 'fulfilled' ? content.value.banners : [],
      offers: content.status === 'fulfilled' ? content.value.offers : [],
      categories: categories.status === 'fulfilled' ? categories.value.items : [],
      brands: brands.status === 'fulfilled' ? brands.value.items : [],
      bestSellers: best.status === 'fulfilled' ? best.value.items : [],
      newArrivals: newest.status === 'fulfilled' ? newest.value.items : [],
    });
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (data.banners.length < 2) return;
    const timer = window.setInterval(() => setActiveBanner((index) => (index + 1) % data.banners.length), 7000);
    return () => window.clearInterval(timer);
  }, [data.banners.length]);

  const allCategories = useMemo(() => flatten(data.categories), [data.categories]);
  const banner = data.banners[activeBanner];
  const Forward = locale === 'ar' ? ArrowLeft : ArrowRight;
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  async function uploadPrescription(file?: File) {
    if (!file) return;
    if (!user) {
      toast({ title: t('login'), message: t('prescriptionLogin'), kind: 'info' });
      return;
    }
    if (file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      toast({ title: t('uploadPrescription'), message: t('prescriptionFileError'), kind: 'error' });
      return;
    }
    setUploading(true);
    try {
      await api.uploadPrescription(file);
      toast({ title: t('prescriptionSent'), kind: 'success' });
    } catch (uploadError) {
      toast({ title: t('loadError'), message: uploadError instanceof Error ? uploadError.message : undefined, kind: 'error' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="home-page">
      {error ? <div className="page-shell page-error" role="alert"><p>{t('loadError')}</p><Button onClick={() => void load()}>{t('retry')}</Button></div> : null}
      <section className="hero page-shell" aria-label={t('home')}>
        {loading ? <div className="hero-skeleton"><Skeleton /><Skeleton lines={2} /></div> : banner ? (
          <article className="hero-banner">
            <img className="hero-banner__image" src={banner.imageUrl} alt="" />
            <div className="hero-banner__shade" />
            <div className="hero-banner__content">
              <span className="hero-banner__overline"><Sparkles size={16} aria-hidden="true" /> Namaa</span>
              <h1>{locale === 'ar' ? banner.titleAr : banner.title}</h1>
              <p>{locale === 'ar' ? banner.subtitleAr || banner.subtitle : banner.subtitle}</p>
              {banner.href ? <Link className="button-link button-link--light" to={banner.href}>{t('shopNow')}<Forward size={17} aria-hidden="true" /></Link> : null}
            </div>
            {data.banners.length > 1 ? <div className="hero-banner__controls">
              <button type="button" aria-label={t('previousBanner')} onClick={() => setActiveBanner((activeBanner - 1 + data.banners.length) % data.banners.length)}><Back size={18} /></button>
              <span>{String(activeBanner + 1).padStart(2, '0')} / {String(data.banners.length).padStart(2, '0')}</span>
              <button type="button" aria-label={t('nextBanner')} onClick={() => setActiveBanner((activeBanner + 1) % data.banners.length)}><Forward size={18} /></button>
            </div> : null}
          </article>
        ) : (
          <div className="hero-empty">
            <div><p className="eyebrow">Namaa / نماء</p><h1>{t('heroFallback')}</h1><p>{t('tagline')}</p><Link className="button-link button-link--green" to="/products">{t('shopNow')}<Forward size={17} /></Link></div>
            <div className="hero-empty__graphic" aria-hidden="true"><Leaf size={138} strokeWidth={1} /></div>
          </div>
        )}
      </section>

      <section className="page-shell category-section">
        <SectionHeading title={t('featuredCategories')} eyebrow={t('discover')} to="/products" linkLabel={t('viewAll')} />
        {loading ? <div className="category-strip"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : allCategories.length ? (
          <div className="category-strip">
            {allCategories.slice(0, 6).map((category, index) => {
              const CategoryIcon = [HeartPulse, Leaf, Sparkles, ShieldCheck][index % 4];
              return <Link key={category.id} className="category-tile" to={`/products?category=${encodeURIComponent(category.slug)}`}>
                <span className="category-tile__icon"><CategoryIcon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                <span>{category.name}</span><Forward size={15} className="category-tile__arrow" aria-hidden="true" />
              </Link>;
            })}
          </div>
        ) : <p className="empty-state">{t('categoriesUnavailable')}</p>}
      </section>

      <section className="page-shell section-block" id="best-sellers">
        <SectionHeading title={t('bestSellers')} eyebrow={t('curatedForYou')} to="/products?sort=best_selling" linkLabel={t('viewAll')} />
        <ProductGrid products={data.bestSellers} loading={loading} error={false} onRetry={() => void load()} />
      </section>

      <section className="offer-band" id="offers">
        <div className="page-shell">
          <SectionHeading title={t('dailyOffers')} eyebrow={t('justForYou')} to="/products" linkLabel={t('viewAll')} />
          {loading ? <div className="offer-grid"><Skeleton /><Skeleton /></div> : data.offers.length ? (
            <div className="offer-grid">
              {data.offers.slice(0, 3).map((offer) => (
                <article className="offer-card" key={offer.id}>
                  <span className="offer-card__icon"><BadgePercent size={25} aria-hidden="true" /></span>
                  <div className="offer-card__copy">
                    <p className="offer-card__value">{offer.type === 'PERCENTAGE' ? `${Number(offer.value)}%` : formatCurrency(offer.value)}</p>
                    <h3>{locale === 'ar' ? offer.nameAr : offer.name}</h3>
                    <p>{locale === 'ar' ? offer.descriptionAr : offer.description}</p>
                  </div>
                  <Link to="/products" className="offer-card__link" aria-label={t('shopNow')}><Forward size={18} /></Link>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">{t('noOffers')}</p>}
        </div>
      </section>

      <section className="page-shell section-block">
        <SectionHeading title={t('newArrivals')} eyebrow={t('freshFinds')} to="/products?sort=newest" linkLabel={t('viewAll')} />
        <ProductGrid products={data.newArrivals} loading={loading} />
      </section>

      <section className="brand-band">
        <div className="page-shell">
          <SectionHeading title={t('trustedBrands')} eyebrow={t('ourSelection')} to="/products" linkLabel={t('viewAll')} />
          {loading ? <div className="brand-strip"><Skeleton /><Skeleton /><Skeleton /></div> : data.brands.length ? (
            <div className="brand-strip">{data.brands.slice(0, 6).map((brand) => <Link key={brand.id} to={`/products?brand=${encodeURIComponent(brand.slug)}`} className="brand-chip">{brand.name}<span><ArrowDownLeft size={14} /></span></Link>)}</div>
          ) : <p className="empty-state">{t('brandsUnavailable')}</p>}
        </div>
      </section>

      <section className="page-shell prescription-band">
        <div className="prescription-band__icon"><Upload size={27} aria-hidden="true" /></div>
        <div className="prescription-band__copy"><p className="section-heading__eyebrow">{t('pharmacySupport')}</p><h2>{t('prescriptionTitle')}</h2><p>{t('prescriptionCopy')}</p></div>
        {user ? <label className={`button-link button-link--green prescription-upload${uploading ? ' is-loading' : ''}`}>
          {uploading ? t('uploading') : t('uploadPrescription')}<Upload size={17} aria-hidden="true" />
          <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploading} onChange={(event) => { void uploadPrescription(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </label> : <Link className="button-link button-link--green" to="/login">{t('login')}<Forward size={17} /></Link>}
      </section>

      <section className="delivery-band">
        <div className="page-shell delivery-band__inner">
          <div><span className="delivery-band__number">01</span><TruckIcon /><h3>{t('deliveryTime')}</h3><p>{t('deliveryCopy')}</p></div>
          <div><span className="delivery-band__number">02</span><ShieldCheck /><h3>{t('support')}</h3><p>{t('supportCopy')}</p></div>
          <div><span className="delivery-band__number">03</span><HeartPulse /><h3>{t('carefulChoices')}</h3><p>{t('carefulChoicesCopy')}</p></div>
        </div>
      </section>
    </div>
  );
}

function flatten(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flatten(category.children ?? [])]);
}

function TruckIcon() {
  return <ArrowRight className="delivery-van" size={22} aria-hidden="true" />;
}
