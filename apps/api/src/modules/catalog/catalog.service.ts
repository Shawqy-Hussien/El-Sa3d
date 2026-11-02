/* eslint-disable @typescript-eslint/no-explicit-any */
import { CatalogRepository } from './catalog.repository.js';
import { buildSuggestions, productSearchRank } from './search.js';

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async listProducts(query: Record<string, unknown> = {}) {
    const page = Number(query.page ?? 1);
    const pageSize = Number(query.pageSize ?? 20);
    const raw = await this.repository.listProducts({
      page,
      pageSize,
      sort:
        (query.sort as
          'newest' | 'price_asc' | 'price_desc' | 'best_selling') ?? 'newest',
      filters: {
        categoryId:
          typeof query.category === 'string' ? query.category : undefined,
        brandId: typeof query.brand === 'string' ? query.brand : undefined,
        minPrice:
          typeof query.minPrice === 'string'
            ? Number(query.minPrice)
            : undefined,
        maxPrice:
          typeof query.maxPrice === 'string'
            ? Number(query.maxPrice)
            : undefined,
        inStock:
          query.inStock === 'true' || query.inStock === true ? true : undefined,
        productType:
          typeof query.productType === 'string' ? query.productType : undefined,
        search: typeof query.search === 'string' ? query.search : undefined,
        includeArchived: false,
      },
    });

    const filtered = (raw.items ?? []).filter(
      (product: any) => product.status !== 'ARCHIVED' && !product.deletedAt,
    );
    const sorted = [...filtered].sort((left: any, right: any) => {
      const leftPrice = Math.min(
        ...(left.variants ?? []).map((variant: any) =>
          Number(variant?.price ?? Infinity),
        ),
      );
      const rightPrice = Math.min(
        ...(right.variants ?? []).map((variant: any) =>
          Number(variant?.price ?? Infinity),
        ),
      );
      if (query.sort === 'price_asc') return leftPrice - rightPrice;
      if (query.sort === 'price_desc') return rightPrice - leftPrice;
      return 0;
    });
    const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize);
    const total = raw.total || filtered.length;
    const products = pageItems.map((product: any) => ({
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      slug: product.slug,
      description: product.description,
      activeIngredient: product.activeIngredient,
      activeIngredientAr: product.activeIngredientAr,
      type: product.type,
      prescriptionRequired: product.prescriptionRequired,
      status: product.status,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
      brand: product.brand
        ? { id: product.brand.id, name: product.brand.name }
        : null,
      variants: product.variants
        .filter((variant: any) => {
          const price = Number(variant.price);
          const available =
            Number(variant.inventory?.quantity ?? 0) -
            Number(variant.inventory?.reservedQuantity ?? 0);
          if (
            typeof query.minPrice === 'string' &&
            price < Number(query.minPrice)
          )
            return false;
          if (
            typeof query.maxPrice === 'string' &&
            price > Number(query.maxPrice)
          )
            return false;
          if (query.inStock === 'true' && available <= 0) return false;
          if (query.inStock === 'false' && available > 0) return false;
          return true;
        })
        .map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price.toString(),
          currency: variant.currency,
          compareAtPrice: variant.compareAtPrice?.toString(),
          inventory: variant.inventory
            ? {
                quantity: variant.inventory.quantity,
                reservedQuantity: variant.inventory.reservedQuantity,
              }
            : null,
        })),
    }));

    return {
      products,
      items: products,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getProduct(productId: string) {
    const product = await this.repository.getProductById(productId);
    if (!product || product.status !== 'ACTIVE' || product.deletedAt) {
      return null;
    }

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      nameAr: product.nameAr,
      activeIngredient: product.activeIngredient,
      activeIngredientAr: product.activeIngredientAr,
      type: product.type,
      prescriptionRequired: product.prescriptionRequired,
      status: product.status,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
      brand: product.brand
        ? { id: product.brand.id, name: product.brand.name }
        : null,
      variants: product.variants.map((variant: any) => ({
        id: variant.id,
        name: variant.name,
        price: variant.price.toString(),
        currency: variant.currency,
        compareAtPrice: variant.compareAtPrice?.toString(),
        inventory: variant.inventory
          ? {
              quantity: variant.inventory.quantity,
              reservedQuantity: variant.inventory.reservedQuantity,
            }
          : null,
      })),
      images: product.images.map((image: any) => ({
        id: image.id,
        url: image.url,
        altText: image.altText,
        sortOrder: image.sortOrder,
      })),
    };
  }

  async getCategories() {
    const categories = (await this.repository.listCategories()) as any[];
    const byId = new Map(
      categories.map((category) => [
        category.id,
        { ...category, children: [] as any[] },
      ]),
    );
    const roots: any[] = [];
    for (const category of categories) {
      const current = byId.get(category.id)!;
      const parent = category.parentId
        ? byId.get(category.parentId)
        : undefined;
      if (parent) parent.children.push(current);
      else roots.push(current);
    }
    return { items: roots };
  }

  async getBrands() {
    const brands = await this.repository.listBrands();
    return { items: brands };
  }

  async searchProducts(query: string, limit = 10) {
    const result = await this.repository.searchProducts(query, limit);
    const items = result.items
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        nameAr: product.nameAr,
        slug: product.slug,
        description: product.description,
        activeIngredient: product.activeIngredient,
        activeIngredientAr: product.activeIngredientAr,
        type: product.type,
        prescriptionRequired: product.prescriptionRequired,
        brand: product.brand
          ? { id: product.brand.id, name: product.brand.name }
          : null,
        category: product.category
          ? { id: product.category.id, name: product.category.name }
          : null,
        score: productSearchRank(product, query),
        variants: product.variants.map((variant: any) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price.toString(),
          currency: variant.currency,
          inventory: variant.inventory
            ? {
                quantity: variant.inventory.quantity,
                reservedQuantity: variant.inventory.reservedQuantity,
              }
            : null,
        })),
      }))
      .sort((a: any, b: any) => b.score - a.score);

    return {
      items,
      suggestions: buildSuggestions(result.items, query, limit),
      total: items.length,
    };
  }

  async saveRecentSearch(userId: string, query: string) {
    if (query.trim())
      await this.repository.saveRecentSearch(
        userId,
        query.trim().slice(0, 240),
      );
  }
}
