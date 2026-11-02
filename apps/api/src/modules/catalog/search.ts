export function normalizeArabic(value: string): string {
  if (!value) return '';

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[\u0621\u0623\u0625\u0622\u0671]/g, 'ا')
    .replace(/[\u0624]/g, 'و')
    .replace(/[\u0626]/g, 'ي')
    .replace(/[\u0649]/g, 'ي')
    .replace(/[\u0643]/g, 'ك')
    .replace(/[\u0629]/g, 'ه')
    .replace(/[\u0640]/g, '')
    .replace(/[\u0651\u0640]/g, '')
    .replace(/[\s_\-]+/g, ' ')
    .toLowerCase()
    .trim();
}

export function buildSearchTokens(value: string): string[] {
  const normalized = normalizeArabic(value);
  const tokens = new Set<string>();

  for (const part of normalized.split(/\s+/)) {
    if (part) tokens.add(part);
  }

  return [...tokens];
}

export function matchesSearchValue(
  source: string | null | undefined,
  query: string,
): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeArabic(query);
  const values = [source ?? '']
    .map((entry) => normalizeArabic(entry))
    .filter(Boolean);

  return values.some((entry) => entry.includes(normalizedQuery));
}

export function productSearchRank(product: unknown, query: string): number {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return 0;
  const item = isRecord(product) ? product : {};

  const candidateFields = [
    item.name,
    item.nameAr,
    item.activeIngredient,
    item.activeIngredientAr,
    nestedName(item.brand),
    item.description,
    nestedName(item.category),
  ].filter((field): field is string => typeof field === 'string');

  const best = candidateFields.reduce((score, field) => {
    const normalized = normalizeArabic(field);
    if (!normalized) return score;
    if (normalized === normalizedQuery) return score + 100;
    if (normalized.startsWith(normalizedQuery)) return score + 70;
    if (normalized.includes(normalizedQuery)) return score + 40;
    return score;
  }, 0);

  return best;
}

export function buildSuggestions(
  items: unknown[],
  query: string,
  limit = 5,
): string[] {
  const input = normalizeArabic(query || '').trim();
  if (!input) return [];

  const seen = new Set<string>();

  for (const item of items) {
    const record = isRecord(item) ? item : {};
    const candidates = [
      record.name,
      record.nameAr,
      nestedName(record.brand),
      record.activeIngredient,
      record.activeIngredientAr,
      nestedName(record.category),
    ].filter((candidate): candidate is string => typeof candidate === 'string');

    for (const candidate of candidates) {
      const normalized = normalizeArabic(candidate);
      if (!normalized.includes(input)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      if (seen.size >= limit) return [...seen];
    }
  }

  return [...seen];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function nestedName(value: unknown): string | undefined {
  return isRecord(value) && typeof value.name === 'string'
    ? value.name
    : undefined;
}
