import { Clock3, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { useLocale } from '../i18n.js';

export function SearchBox({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      if (user) {
        api.getRecentSearches()
          .then((result) => setRecent(result.searches.map((item) => item.query)))
          .catch(() => setRecent([]));
      }
      return;
    }
    const timeout = window.setTimeout(() => {
      api.search(query, 6)
        .then((result) => setSuggestions(result.suggestions))
        .catch(() => setSuggestions([]));
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query, user]);

  useEffect(() => {
    function onOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(value)}`);
  }

  const options = query.trim() ? suggestions : recent;
  const listId = compact ? 'compact-search-options' : 'header-search-options';

  return (
    <form
      ref={rootRef}
      className={`search-box${compact ? ' search-box--compact' : ''}`}
      role="search"
      onSubmit={submit}
    >
      <Search className="search-box__icon" size={19} aria-hidden="true" />
      <input
        type="search"
        value={query}
        placeholder={t('search')}
        aria-label={t('searchLabel')}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, options.length - 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'Enter' && active >= 0 && options[active]) {
            event.preventDefault();
            setQuery(options[active]);
            navigate(`/search?q=${encodeURIComponent(options[active])}`);
            setOpen(false);
          }
        }}
      />
      {query ? (
        <button type="button" className="search-box__clear" aria-label={t('close')} onClick={() => setQuery('')}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
      <button className="search-box__submit" type="submit" aria-label={t('searchButton')}>
        <Search size={18} aria-hidden="true" />
      </button>
      {open && options.length > 0 ? (
        <ul className="search-box__list" id={listId} role="listbox" aria-label={query ? t('searchLabel') : t('recentSearches')}>
          {options.map((option, index) => (
            <li key={`${option}-${index}`} role="presentation">
              <button
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={active === index}
                className={active === index ? 'is-active' : ''}
                onClick={() => { setQuery(option); navigate(`/search?q=${encodeURIComponent(option)}`); setOpen(false); }}
              >
                {query ? <Search size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
                <span>{option}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
