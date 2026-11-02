export interface QueryPagination {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function normalizePagination(
  query: Record<string, string | string[] | undefined>,
  defaults: { page?: number; pageSize?: number } = {},
): QueryPagination {
  const page = Number(Array.isArray(query.page) ? query.page[0] : query.page ?? defaults.page ?? 1);
  const pageSize = Number(
    Array.isArray(query.pageSize) ? query.pageSize[0] : query.pageSize ?? defaults.pageSize ?? 20,
  );
  const sortBy =
    typeof query.sortBy === 'string' ? query.sortBy : undefined;
  const rawSortOrder =
    typeof query.sortOrder === 'string' ? query.sortOrder.toLowerCase() : 'asc';

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
    sortBy,
    sortOrder: rawSortOrder === 'desc' ? 'desc' : 'asc',
  };
}
