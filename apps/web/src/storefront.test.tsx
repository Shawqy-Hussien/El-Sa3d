import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth.js';
import { LanguageSwitcher } from './components/LanguageSwitcher.js';
import { SearchBox } from './components/SearchBox.js';
import { LocaleProvider } from './i18n.js';
import AuthPage from './pages/AuthPage.js';

function LocationView() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('customer storefront interactions', () => {
  it('uses the shared registration validation before sending an API request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <LocaleProvider>
        <AuthProvider>
          <MemoryRouter>
            <AuthPage mode="register" />
          </MemoryRouter>
        </AuthProvider>
      </LocaleProvider>,
    );

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'not-an-email');
    await user.type(screen.getByLabelText('كلمة المرور'), 'weak');
    await user.click(screen.getByRole('button', { name: 'إنشاء حساب' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('أدخل بريداً إلكترونياً صحيحاً.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('switches Arabic RTL to English LTR and persists the selection', async () => {
    const user = userEvent.setup();
    render(<LocaleProvider><LanguageSwitcher /></LocaleProvider>);

    expect(document.documentElement.dir).toBe('rtl');
    await user.click(screen.getByRole('button', { name: 'Switch language to Arabic' }));

    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
    expect(document.documentElement.lang).toBe('en');
    expect(window.localStorage.getItem('namaa-locale')).toBe('en');
  });

  it('loads API suggestions and navigates to the selected search', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [], suggestions: ['Vitamin C'], total: 0 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <LocaleProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="*" element={<><SearchBox /><LocationView /></>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </LocaleProvider>,
    );

    await user.type(screen.getByRole('combobox', { name: 'ابحث في المنتجات' }), 'vita');
    await user.click(await screen.findByRole('option', { name: 'Vitamin C' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/search?q=Vitamin%20C');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/products/search?q=vita'), expect.any(Object));
  });
});
