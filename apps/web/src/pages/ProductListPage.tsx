import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Skeleton } from '@elsa3d/ui';
import { api, type Brand, type Category, type Product } from '../api.js';
import { useLocale } from '../i18n.js';
import { ProductGrid } from '../components/ProductGrid.js';

const types = ['MEDICINE', 'SUPPLEMENT', 'PERSONAL_CARE', 'MEDICAL_DEVICE', 'OTHER'] as const;

export default function ProductListPage() {
  const { t } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState(() => readFilters(searchParams));

  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const categoryOptions = useMemo(() => flatten(categories), [categories]);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getBrands()])
      .then(([categoryResult, brandResult]) => {
        setCategories(categoryResult.items);
        setBrands(brandResult.items);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setDraft(readFilters(searchParams));
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    params.set('pageSize', '12');
    setLoading(true);
    setError(false);
    api.getProducts(params)
      .then((result) => {
        setProducts(result.items);
        setTotal(result.meta.total);
        setTotalPages(Math.max(result.meta.totalPages, 1));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [searchParams, page]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(draft).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', '1');
    setSearchParams(params);
  }

  function clearFilters() {
    setDraft({});
    setSearchParams({ page: '1' });
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page-shell listing-page">
      <div className="listing-heading"><div><p className="section-heading__eyebrow">Namaa / نماء</p><h1>{t('allProducts')}</h1><p>{new Intl.NumberFormat('en').format(total)} {t('results')}</p></div>
        <label className="sort-control"><span>{t('sort')}</span><select value={searchParams.get('sort') ?? 'newest'} onChange={(event) => { const next = new URLSearchParams(searchParams); next.set('sort', event.target.value); next.set('page', '1'); setSearchParams(next); }}>
          <option value="newest">{t('newest')}</option><option value="price_asc">{t('priceLow')}</option><option value="price_desc">{t('priceHigh')}</option><option value="best_selling">{t('bestSelling')}</option>
        </select></label>
      </div>
      <div className="listing-layout">
        <aside className="filter-panel">
          <div className="filter-panel__heading"><SlidersHorizontal size={18} aria-hidden="true" /><h2>{t('filters')}</h2></div>
          <form onSubmit={applyFilters}>
            <label className="filter-field"><span>{t('category')}</span><select value={draft.category ?? ''} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
              <option value="">{t('allCategories')}</option>{categoryOptions.map((category) => <option value={category.slug} key={category.id}>{category.name}</option>)}
            </select></label>
            <label className="filter-field"><span>{t('brand')}</span><select value={draft.brand ?? ''} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}>
              <option value="">{t('allBrands')}</option>{brands.map((brand) => <option value={brand.slug} key={brand.id}>{brand.name}</option>)}
            </select></label>
            <fieldset className="price-filter"><legend>{t('price')} · EGP</legend><div className="price-filter__inputs">
              <Input label={t('minPrice')} inputMode="decimal" type="number" min="0" value={draft.minPrice ?? ''} onChange={(event) => setDraft((current) => ({ ...current, minPrice: event.target.value }))} />
              <Input label={t('maxPrice')} inputMode="decimal" type="number" min="0" value={draft.maxPrice ?? ''} onChange={(event) => setDraft((current) => ({ ...current, maxPrice: event.target.value }))} />
            </div></fieldset>
            <label className="filter-field"><span>{t('productType')}</span><select value={draft.productType ?? ''} onChange={(event) => setDraft((current) => ({ ...current, productType: event.target.value }))}>
              <option value="">{t('allTypes')}</option>{types.map((type) => <option value={type} key={type}>{t(type)}</option>)}
            </select></label>
            <label className="check-field"><input type="checkbox" checked={draft.inStock === 'true'} onChange={(event) => setDraft((current) => ({ ...current, inStock: event.target.checked ? 'true' : '' }))} /><span>{t('inStock')}</span></label>
            <Button type="submit" className="filter-submit">{t('applyFilters')}</Button>
            <button type="button" className="filter-clear" onClick={clearFilters}>{t('clearFilters')}</button>
          </form>
        </aside>
        <div className="listing-results">
          {error ? <div className="inline-state inline-state--error" role="alert"><span>{t('loadError')}</span><Button variant="secondary" onClick={() => setSearchParams(new URLSearchParams(searchParams))}>{t('retry')}</Button></div> : null}
          {loading ? <div className="product-grid"><Skeleton className="product-skeleton" lines={3} /><Skeleton className="product-skeleton" lines={3} /><Skeleton className="product-skeleton" lines={3} /></div> : <ProductGrid products={products} emptyMessage={t('emptyProducts')} />}
          {!loading && totalPages > 1 ? <nav className="pagination" aria-label={t('pagination')}>
            <Button variant="secondary" size="small" disabled={page <= 1} onClick={() => changePage(page - 1)}>{t('previousPage')}</Button>
            <span>{t('page')} <strong>{page}</strong> / {totalPages}</span>
            <Button variant="secondary" size="small" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>{t('nextPage')}</Button>
          </nav> : null}
        </div>
      </div>
    </div>
  );
}

function readFilters(params: URLSearchParams): Record<string, string> {
  const keys = ['category', 'brand', 'minPrice', 'maxPrice', 'productType', 'inStock'];
  return Object.fromEntries(keys.flatMap((key) => params.get(key) ? [[key, params.get(key)!]] : []));
}

function flatten(categories: Category[]): Category[] {
  return categories.flatMap((category) => [category, ...flatten(category.children ?? [])]);
}
