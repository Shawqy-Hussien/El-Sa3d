import type { Request, Response } from 'express';
import { CatalogService } from './catalog.service.js';

export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  getProducts = async (request: Request, response: Response): Promise<void> => {
    const page = numericQuery(request.query.page, 1);
    const pageSize = numericQuery(request.query.pageSize, 20);
    const minPrice = optionalNumericQuery(request.query.minPrice);
    const maxPrice = optionalNumericQuery(request.query.maxPrice);
    const sort = request.query.sort;
    const inStock = request.query.inStock;
    if (
      page === null ||
      page < 1 ||
      !Number.isInteger(page) ||
      pageSize === null ||
      pageSize < 1 ||
      pageSize > 100 ||
      !Number.isInteger(pageSize) ||
      minPrice === null ||
      maxPrice === null ||
      (minPrice !== undefined && minPrice < 0) ||
      (maxPrice !== undefined && maxPrice < 0) ||
      (minPrice !== undefined &&
        maxPrice !== undefined &&
        minPrice > maxPrice) ||
      (sort !== undefined &&
        !['newest', 'price_asc', 'price_desc', 'best_selling'].includes(
          String(sort),
        )) ||
      (inStock !== undefined && inStock !== 'true' && inStock !== 'false')
    ) {
      response.status(400).json({ error: 'invalid_query' });
      return;
    }
    const body = await this.service.listProducts(request.query);
    response.json(body);
  };

  getCategories = async (
    _request: Request,
    response: Response,
  ): Promise<void> => {
    response.json(await this.service.getCategories());
  };

  getBrands = async (_request: Request, response: Response): Promise<void> => {
    response.json(await this.service.getBrands());
  };

  searchProducts = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q : '';
    const requestedLimit = Number(request.query.limit ?? 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(20, requestedLimit))
      : 10;
    if (request.auth && query) {
      await this.service.saveRecentSearch(request.auth.userId, query);
    }
    response.json(await this.service.searchProducts(query, limit));
  };

  searchSuggestions = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const query = typeof request.query.q === 'string' ? request.query.q : '';
    const result = await this.service.searchProducts(query, 8);
    response.json({ suggestions: result.suggestions });
  };

  getProductById = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    const productId = Array.isArray(request.params.productId)
      ? request.params.productId[0]
      : request.params.productId;
    const product = await this.service.getProduct(productId);

    if (!product) {
      response.status(404).json({ error: 'product_not_found' });
      return;
    }

    response.json(product);
  };
}

function numericQuery(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalNumericQuery(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  return numericQuery(value, 0);
}
