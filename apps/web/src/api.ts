export interface ProductVariant {
  id: string;
  name: string;
  price: string;
  compareAtPrice?: string | null;
  currency: string;
  inventory?: { quantity: number; reservedQuantity: number } | null;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  description?: string | null;
  activeIngredient?: string | null;
  activeIngredientAr?: string | null;
  type?: string;
  prescriptionRequired?: boolean;
  status?: string;
  category?: { id: string; name: string; slug?: string } | null;
  brand?: { id: string; name: string; slug?: string } | null;
  variants: ProductVariant[];
  images?: Array<{ id: string; url: string; altText?: string | null; sortOrder: number }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
}

export interface Offer {
  id: string;
  name: string;
  nameAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  startsAt: string;
  endsAt: string;
}

export interface StorefrontBanner {
  id: string;
  title: string;
  titleAr: string;
  subtitle?: string | null;
  subtitleAr?: string | null;
  imageUrl: string;
  href?: string | null;
}

export interface PageResult<T> {
  items: T[];
  products?: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiUser {
  id: string;
  email: string;
  role: string;
  emailVerifiedAt?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${apiBase}/auth/csrf`, { credentials: 'include' });
  if (!response.ok) throw new ApiError('Could not establish a secure session.', response.status);
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof Blob) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new ApiError(body.message ?? body.error ?? 'Request failed.', response.status, body.error);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function mutate<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const token = await getCsrfToken();
  return request<T>(path, {
    method,
    headers: {
      'X-Auth-Transport': 'cookie',
      'X-CSRF-Token': token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  getProducts(params: URLSearchParams = new URLSearchParams()) {
    return request<PageResult<Product>>(`/products?${params.toString()}`);
  },
  getProduct(idOrSlug: string) {
    return request<Product>(`/products/${encodeURIComponent(idOrSlug)}`);
  },
  getCategories() {
    return request<{ items: Category[] }>('/products/categories');
  },
  getBrands() {
    return request<{ items: Brand[] }>('/products/brands');
  },
  search(query: string, limit = 8) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return request<{ items: Product[]; suggestions: string[]; total: number }>(
      `/products/search?${params.toString()}`,
    );
  },
  getRecentSearches() {
    return request<{ searches: Array<{ query: string }> }>('/products/search/recent', {
      headers: { 'X-Auth-Transport': 'cookie' },
    });
  },
  getStorefrontContent() {
    return request<{ banners: StorefrontBanner[]; offers: Offer[] }>('/storefront/content');
  },
  login(email: string, password: string) {
    return mutate<{ user: ApiUser }>('/auth/login', 'POST', { email, password });
  },
  register(email: string, password: string) {
    return mutate<{ message: string }>('/auth/register', 'POST', { email, password });
  },
  requestPasswordReset(email: string) {
    return mutate<{ message: string }>('/auth/password-reset/request', 'POST', { email });
  },
  confirmPasswordReset(token: string, password: string) {
    return mutate<void>('/auth/password-reset/confirm', 'POST', { token, password });
  },
  verifyEmail(token: string) {
    return mutate<void>('/auth/email/verify', 'POST', { token });
  },
  async logout() {
    return mutate<void>('/auth/logout', 'POST', {});
  },
  async uploadPrescription(file: File) {
    const token = await getCsrfToken();
    const response = await fetch(`${apiBase}/prescriptions`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': file.type,
        'X-Auth-Transport': 'cookie',
        'X-CSRF-Token': token,
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new ApiError(body.message ?? body.error ?? 'Upload failed.', response.status);
    }
    return response.json() as Promise<{ prescription: { id: string; status: string } }>;
  },
};
