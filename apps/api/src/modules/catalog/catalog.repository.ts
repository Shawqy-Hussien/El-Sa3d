/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { ProductStatus, ProductType } from '../../generated/prisma/enums.js';
import { HttpError } from '../../errors/http-error.js';

export interface ProductListFilters {
  categoryId?: string;
  brandId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  productType?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface ProductListOptions {
  page: number;
  pageSize: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'best_selling';
  filters?: ProductListFilters;
}

export class CatalogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listProducts(options: ProductListOptions = { page: 1, pageSize: 20 }) {
    const prismaProduct = this.prisma.product as any;
    const rawQuery = (this.prisma as any).$queryRaw;
    const filters = options.filters ?? {};
    const variantsWhere: Prisma.ProductVariantWhereInput = {
      deletedAt: null,
      isActive: true,
      ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            price: {
              gte: filters.minPrice,
              lte: filters.maxPrice,
            },
          }
        : {}),
    };
    if (typeof rawQuery === 'function') {
      const conditions = [
        Prisma.sql`p.deleted_at IS NULL`,
        filters.includeArchived
          ? Prisma.sql`TRUE`
          : Prisma.sql`p.status = 'ACTIVE'::"ProductStatus"`,
      ];
      if (filters.categoryId)
        conditions.push(Prisma.sql`p.category_id IN (
        WITH RECURSIVE category_tree AS (
          SELECT id FROM categories WHERE id::text = ${filters.categoryId} OR slug = ${filters.categoryId}
          UNION ALL
          SELECT child.id FROM categories child JOIN category_tree parent ON child.parent_id = parent.id
          WHERE child.deleted_at IS NULL AND child.is_active = TRUE
        ) SELECT id FROM category_tree
      )`);
      if (filters.brandId)
        conditions.push(
          Prisma.sql`p.brand_id IN (SELECT id FROM brands WHERE id::text = ${filters.brandId} OR slug = ${filters.brandId})`,
        );
      if (filters.productType)
        conditions.push(Prisma.sql`p.type::text = ${filters.productType}`);
      if (filters.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(Prisma.sql`(
          normalize_arabic_search(p.name) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.name_ar) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.active_ingredient) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.active_ingredient_ar) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(b.name) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(c.name) LIKE normalize_arabic_search(${pattern}) OR
          to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.name_ar, '') || ' ' || coalesce(p.active_ingredient, '') || ' ' || coalesce(p.active_ingredient_ar, ''))
            @@ plainto_tsquery('simple', ${filters.search})
        )`);
      }
      if (
        filters.minPrice !== undefined ||
        filters.maxPrice !== undefined ||
        filters.inStock === true
      ) {
        const variantConditions = [
          Prisma.sql`v.product_id = p.id`,
          Prisma.sql`v.deleted_at IS NULL`,
          Prisma.sql`v.is_active = TRUE`,
        ];
        if (filters.minPrice !== undefined)
          variantConditions.push(Prisma.sql`v.price >= ${filters.minPrice}`);
        if (filters.maxPrice !== undefined)
          variantConditions.push(Prisma.sql`v.price <= ${filters.maxPrice}`);
        if (filters.inStock === true)
          variantConditions.push(
            Prisma.sql`coalesce(i.quantity, 0) - coalesce(i.reserved_quantity, 0) > 0`,
          );
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM product_variants v
          LEFT JOIN inventory i ON i.variant_id = v.id
          WHERE ${Prisma.join(variantConditions, ' AND ')}
        )`);
      }
      if (filters.inStock === false) {
        conditions.push(Prisma.sql`NOT EXISTS (
          SELECT 1 FROM product_variants v
          JOIN inventory i ON i.variant_id = v.id
          WHERE v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active = TRUE
            AND i.quantity - i.reserved_quantity > 0
        )`);
      }
      const orderBy =
        options.sort === 'price_asc'
          ? Prisma.sql`price ASC NULLS LAST`
          : options.sort === 'price_desc'
            ? Prisma.sql`price DESC NULLS LAST`
            : options.sort === 'best_selling'
              ? Prisma.sql`sold DESC, p.created_at DESC`
              : Prisma.sql`p.created_at DESC`;
      const whereClause = Prisma.join(conditions, ' AND ');
      const [rows, count] = await Promise.all([
        rawQuery.call(
          this.prisma,
          Prisma.sql`
          SELECT p.id,
            (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active = TRUE) AS price,
            (SELECT coalesce(SUM(oi.quantity), 0)
              FROM order_items oi
              JOIN product_variants sv ON sv.id = oi.variant_id
              JOIN orders o ON o.id = oi.order_id
              WHERE sv.product_id = p.id AND o.status IN ('PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED')) AS sold
          FROM products p
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ${whereClause}
          ORDER BY ${orderBy}
          LIMIT ${options.pageSize} OFFSET ${(options.page - 1) * options.pageSize}
        `,
        ),
        rawQuery.call(
          this.prisma,
          Prisma.sql`
          SELECT count(*)::int AS total
          FROM products p
          LEFT JOIN brands b ON b.id = p.brand_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ${whereClause}
        `,
        ),
      ]);
      const ids = rows.map((row: any) => row.id);
      const items = ids.length
        ? await prismaProduct.findMany({
            where: { id: { in: ids } },
            include: {
              category: true,
              brand: true,
              variants: { where: variantsWhere, include: { inventory: true } },
            },
          })
        : [];
      const order = new Map<string, number>(
        ids.map((id: string, index: number) => [id, index]),
      );
      items.sort(
        (left: any, right: any) =>
          (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
      );
      return { items, total: count[0]?.total ?? 0 };
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(options.filters?.includeArchived
        ? {}
        : { status: ProductStatus.ACTIVE }),
      ...(options.filters?.categoryId
        ? { categoryId: options.filters.categoryId }
        : {}),
      ...(options.filters?.brandId ? { brandId: options.filters.brandId } : {}),
      ...(options.filters?.productType
        ? { type: options.filters.productType as ProductType }
        : {}),
      ...(options.filters?.search
        ? {
            OR: [
              {
                name: { contains: options.filters.search, mode: 'insensitive' },
              },
              {
                slug: { contains: options.filters.search, mode: 'insensitive' },
              },
              {
                description: {
                  contains: options.filters.search,
                  mode: 'insensitive',
                },
              },
              {
                category: {
                  name: {
                    contains: options.filters.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                brand: {
                  name: {
                    contains: options.filters.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const orderBy = this.buildOrderBy(options.sort ?? 'newest');
    const [items, total] = await Promise.all([
      prismaProduct.findMany?.({
        where,
        orderBy,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: {
          category: true,
          brand: true,
          variants: {
            where: variantsWhere,
            include: { inventory: true },
          },
        },
      }) ?? [],
      prismaProduct.count?.({ where }) ?? 0,
    ]);

    return { items, total };
  }

  async getProductById(productId: string) {
    const productModel = this.prisma.product as any;
    const findProduct = productModel?.findFirst ?? productModel?.findUnique;
    if (!findProduct) return null;

    return findProduct({
      where: productModel.findFirst
        ? { OR: [{ id: productId }, { slug: productId }], deletedAt: null }
        : { id: productId, deletedAt: null },
      include: {
        category: true,
        brand: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          where: { deletedAt: null, isActive: true },
          include: { inventory: true },
        },
      },
    });
  }

  async listCategories() {
    const findMany = (this.prisma.category as any)?.findMany;
    if (!findMany) return [];

    return findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { children: true },
    });
  }

  async listBrands() {
    const findMany = (this.prisma.brand as any)?.findMany;
    if (!findMany) return [];

    return findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async searchProducts(query: string, limit = 10) {
    const search = query.trim();
    if (!search) {
      return { items: [], suggestions: [], total: 0 };
    }

    const findMany = (this.prisma.product as any)?.findMany;
    if (!findMany) {
      return { items: [], suggestions: [], total: 0 };
    }

    const normalized = search.toLowerCase();
    let items: any[];
    if (typeof (this.prisma as any).$queryRaw === 'function') {
      const pattern = `%${search}%`;
      const rows = await (this.prisma as any).$queryRaw`
        SELECT p.id,
          GREATEST(
            similarity(normalize_arabic_search(p.name), normalize_arabic_search(${search})),
            similarity(normalize_arabic_search(p.name_ar), normalize_arabic_search(${search})),
            similarity(normalize_arabic_search(p.active_ingredient), normalize_arabic_search(${search})),
            similarity(normalize_arabic_search(p.active_ingredient_ar), normalize_arabic_search(${search}))
          ) AS score
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        WHERE p.status = 'ACTIVE' AND p.deleted_at IS NULL AND (
          normalize_arabic_search(p.name) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.name_ar) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.active_ingredient) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(p.active_ingredient_ar) LIKE normalize_arabic_search(${pattern}) OR
          normalize_arabic_search(b.name) LIKE normalize_arabic_search(${pattern}) OR
          to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.name_ar, '') || ' ' || coalesce(p.active_ingredient, '') || ' ' || coalesce(p.active_ingredient_ar, ''))
            @@ plainto_tsquery('simple', ${search})
        )
        ORDER BY score DESC, p.created_at DESC
        LIMIT ${limit}
      `;
      const ids = rows.map((row: any) => row.id);
      items = ids.length
        ? await findMany({
            where: {
              id: { in: ids },
              status: ProductStatus.ACTIVE,
              deletedAt: null,
            },
            include: {
              category: true,
              brand: true,
              variants: {
                where: { deletedAt: null, isActive: true },
                include: { inventory: true },
              },
            },
          })
        : [];
      const order = new Map<string, number>(
        ids.map((id: string, index: number) => [id, index]),
      );
      items.sort(
        (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
      );
    } else {
      items = await findMany({
        where: {
          deletedAt: null,
          status: ProductStatus.ACTIVE,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { nameAr: { contains: search, mode: 'insensitive' } },
            { activeIngredient: { contains: search, mode: 'insensitive' } },
            { activeIngredientAr: { contains: search, mode: 'insensitive' } },
            { brand: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          brand: true,
          variants: {
            where: { deletedAt: null, isActive: true },
            include: { inventory: true },
          },
        },
      });
    }

    const suggestions = [
      ...new Set(
        items
          .flatMap((product: any) => [
            product.name,
            product.brand?.name,
            product.category?.name,
          ])
          .filter(Boolean),
      ),
    ]
      .filter((value: any) => String(value).toLowerCase().includes(normalized))
      .slice(0, limit);

    return { items, suggestions, total: items.length };
  }

  async getLowStockProducts(limit = 25) {
    const findMany = (this.prisma.product as any)?.findMany;
    if (!findMany) return [];

    const rawQuery = (this.prisma as any).$queryRaw;
    if (typeof rawQuery === 'function') {
      const rows = await rawQuery.call(
        this.prisma,
        Prisma.sql`
        SELECT DISTINCT p.id
        FROM products p
        JOIN product_variants v ON v.product_id = p.id AND v.deleted_at IS NULL AND v.is_active = TRUE
        JOIN inventory i ON i.variant_id = v.id
        WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE'::"ProductStatus"
          AND i.quantity - i.reserved_quantity <= i.reorder_level
        ORDER BY p.id
        LIMIT ${limit}
      `,
      );
      const ids = rows.map((row: any) => row.id);
      if (!ids.length) return [];
      return findMany({
        where: { id: { in: ids } },
        include: {
          category: true,
          brand: true,
          variants: {
            where: { deletedAt: null, isActive: true },
            include: { inventory: true },
          },
        },
      });
    }

    return findMany({
      where: {
        deletedAt: null,
        status: ProductStatus.ACTIVE,
        variants: {
          some: {
            deletedAt: null,
            isActive: true,
            inventory: { quantity: { lte: 10 } },
          },
        },
      },
      take: limit,
      include: {
        category: true,
        brand: true,
        variants: {
          where: { deletedAt: null, isActive: true },
          include: { inventory: true },
        },
      },
    });
  }

  async createInventoryMovement(data: {
    variantId: string;
    type:
      | 'STOCK_IN'
      | 'STOCK_OUT'
      | 'ADJUSTMENT'
      | 'RETURN'
      | 'RESERVED'
      | 'RELEASED';
    quantityChange: number;
    actorUserId?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    reason?: string | null;
  }) {
    const create = (this.prisma.inventoryMovement as any)?.create;
    if (!create) return null;

    return create({
      data: {
        variantId: data.variantId,
        type: data.type,
        quantityChange: data.quantityChange,
        actorUserId: data.actorUserId ?? null,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason ?? null,
      },
    });
  }

  async updateInventoryQuantity(variantId: string, quantity: number) {
    const upsert = (this.prisma.inventory as any)?.upsert;
    if (!upsert) return null;

    return upsert({
      where: { variantId },
      update: { quantity },
      create: {
        variantId,
        quantity,
        reservedQuantity: 0,
        reorderLevel: 0,
      },
    });
  }

  async listRecentSearches(userId: string, limit = 10) {
    const recentSearch = (this.prisma as any).recentSearch;
    if (!recentSearch?.findMany) return [];
    return recentSearch.findMany({
      where: { userId },
      orderBy: { lastSearchedAt: 'desc' },
      take: limit,
    });
  }

  async saveRecentSearch(userId: string, query: string) {
    const recentSearch = (this.prisma as any).recentSearch;
    if (!recentSearch?.upsert) return null;
    return recentSearch.upsert({
      where: { userId_query: { userId, query } },
      create: { userId, query },
      update: { lastSearchedAt: new Date() },
    });
  }

  async createProduct(data: Record<string, unknown>) {
    return (this.prisma.product as any).create({ data });
  }

  async updateProduct(id: string, data: Record<string, unknown>) {
    return (this.prisma.product as any).update({ where: { id }, data });
  }

  async archiveProduct(id: string) {
    return (this.prisma.product as any).update({
      where: { id },
      data: { status: ProductStatus.ARCHIVED, deletedAt: new Date() },
    });
  }

  async createVariant(productId: string, data: Record<string, unknown>) {
    return (this.prisma.productVariant as any).create({
      data: { ...data, productId },
    });
  }

  async updateVariant(id: string, data: Record<string, unknown>) {
    return (this.prisma.productVariant as any).update({ where: { id }, data });
  }

  async createCategory(data: Record<string, unknown>) {
    return (this.prisma.category as any).create({ data });
  }

  async updateCategory(id: string, data: Record<string, unknown>) {
    return (this.prisma.category as any).update({ where: { id }, data });
  }

  async createBrand(data: Record<string, unknown>) {
    return (this.prisma.brand as any).create({ data });
  }

  async updateBrand(id: string, data: Record<string, unknown>) {
    return (this.prisma.brand as any).update({ where: { id }, data });
  }

  async createImage(
    productId: string,
    data: { url: string; altText?: string },
  ) {
    return (this.prisma.productImage as any).create({
      data: { ...data, productId },
    });
  }

  async updateImage(
    id: string,
    data: { altText?: string | null; sortOrder?: number },
  ) {
    return (this.prisma.productImage as any).update({ where: { id }, data });
  }

  async deleteImage(id: string) {
    return (this.prisma.productImage as any).delete({ where: { id } });
  }

  async adjustInventory(data: {
    variantId: string;
    quantityChange: number;
    actorUserId: string;
    reason?: string;
  }) {
    return (this.prisma as any).$transaction(async (transaction: any) => {
      const inventory = await transaction.inventory.findUnique({
        where: { variantId: data.variantId },
      });
      const currentQuantity = inventory?.quantity ?? 0;
      const nextQuantity = currentQuantity + data.quantityChange;
      if (nextQuantity < (inventory?.reservedQuantity ?? 0)) {
        throw new HttpError(
          409,
          'inventory_below_reserved',
          'Stock cannot be reduced below reserved quantity.',
        );
      }

      await transaction.inventory.upsert({
        where: { variantId: data.variantId },
        update: { quantity: nextQuantity },
        create: { variantId: data.variantId, quantity: nextQuantity },
      });
      return transaction.inventoryMovement.create({
        data: {
          variantId: data.variantId,
          actorUserId: data.actorUserId,
          type: data.quantityChange >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
          quantityChange: data.quantityChange,
          reason: data.reason,
        },
      });
    });
  }

  private buildOrderBy(sort: ProductListOptions['sort']) {
    switch (sort) {
      case 'price_asc':
        return [{ variants: { _count: 'desc' } } as never];
      case 'price_desc':
        return [{ createdAt: 'desc' }];
      case 'best_selling':
        return [{ createdAt: 'desc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }];
    }
  }
}
