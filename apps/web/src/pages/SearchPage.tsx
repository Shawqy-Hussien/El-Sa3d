import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Product } from '../api.js';
import { useAuth } from '../auth.js';
import { useLocale } from '../i18n.js';
import { ProductGrid } from '../components/ProductGrid.js';
import { SearchBox } from '../components/SearchBox.js';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const { t } = useLocale();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      setSuggestions([]);
      if (user) api.getRecentSearches().then((result) => setRecent(result.searches.map((item) => item.query))).catch(() => setRecent([]));
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(false);
    api.search(query, 24).then((result) => {
      if (!mounted) return;
      setProducts(result.items);
      setSuggestions(result.suggestions);
    }).catch(() => { if (mounted) setError(true); }).finally(() => { if (mounted) setLoading(false); });
    if (user) api.getRecentSearches().then((result) => { if (mounted) setRecent(result.searches.map((item) => item.query)); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [query, user]);

  function searchAgain(value: string) {
    setParams({ q: value });
  }

  return (
    <div className="page-shell search-page">
      <header className="search-page__heading"><p className="section-heading__eyebrow">Namaa / نماء</p><h1>{query ? `${t('searchResultsFor')} “${query}”` : t('searchTitle')}</h1><div className="search-page__input"><SearchBox compact /></div></header>
      {suggestions.length && query ? <section className="search-suggestions" aria-label={t('suggestions')}><span>{t('suggestions')}</span>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => searchAgain(suggestion)}><Search size={14} />{suggestion}</button>)}</section> : null}
      {query ? <ProductGrid products={products} loading={loading} error={error} onRetry={() => setParams({ q: query })} emptyMessage={t('emptySearch')} /> : user && recent.length ? <section className="recent-searches"><h2>{t('recentSearches')}</h2>{recent.map((item) => <button type="button" key={item} onClick={() => searchAgain(item)}><Search size={15} />{item}</button>)}</section> : <div className="search-empty"><Search size={28} /><p>{t('searchPrompt')}</p><Link to="/products">{t('allProducts')}</Link></div>}
    </div>
  );
}
