import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { ProductListSort } from '../dto/product-list-sort.enum';
import { ProductResponseDto } from '../dto/product-response.dto';

/** @internal 단위 테스트용 — DB 없이 하위 카테고리 ID 집합 계산 */
export function collectCategorySubtreeIds(
  rows: { id: bigint; parentId: bigint | null }[],
  rootId: bigint,
): bigint[] | null {
  const rootExists = rows.some((c) => c.id === rootId);
  if (!rootExists) {
    return null;
  }
  const byParent = new Map<string, bigint[]>();
  for (const c of rows) {
    const key = c.parentId == null ? 'root:null' : c.parentId.toString();
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key)!.push(c.id);
  }
  const out: bigint[] = [];
  const stack: bigint[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    const kids = byParent.get(id.toString()) ?? [];
    for (const k of kids) {
      stack.push(k);
    }
  }
  return out;
}

type ProductRow = {
  id: bigint;
  organizationId: bigint;
  categoryId: bigint | null;
  name: string;
  price: Prisma.Decimal;
  imageKey: string | null;
  productUrl: string | null;
  purchaseCountCache: number;
  createdByUserId: bigint | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: {
    id: bigint;
    organizationId: bigint;
    parentId: bigint | null;
    name: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
  } | null;
};

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  /** Decimal 직렬화: price를 문자열로 변환 */
  private toProductResponse(row: ProductRow): ProductResponseDto {
    const dto: ProductResponseDto = {
      id: Number(row.id),
      organizationId: Number(row.organizationId),
      categoryId: row.categoryId != null ? Number(row.categoryId) : null,
      name: row.name,
      price: typeof row.price === 'string' ? row.price : String(row.price),
      imageKey: row.imageKey,
      productUrl: row.productUrl,
      purchaseCountCache: row.purchaseCountCache,
      createdByUserId:
        row.createdByUserId != null ? Number(row.createdByUserId) : null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
    if (row.category) {
      dto.category = {
        id: Number(row.category.id),
        organizationId: Number(row.category.organizationId),
        parentId:
          row.category.parentId != null ? Number(row.category.parentId) : null,
        name: row.category.name,
        sortOrder: row.category.sortOrder,
        isActive: row.category.isActive,
        createdAt: row.category.createdAt.toISOString(),
      };
    }
    return dto;
  }

  async create(
    dto: CreateProductDto,
    organizationId: number,
    userId: number,
  ): Promise<ProductResponseDto> {
    if (dto.categoryId != null) {
      const cat = await this.prisma.category.findFirst({
        where: {
          id: BigInt(dto.categoryId),
          organizationId: BigInt(organizationId),
        },
      });
      if (!cat) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '카테고리를 찾을 수 없습니다.',
        );
      }
    }

    const created = await this.prisma.product.create({
      data: {
        organizationId: BigInt(organizationId),
        categoryId: dto.categoryId != null ? BigInt(dto.categoryId) : null,
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        imageKey: dto.imageKey ?? null,
        productUrl: dto.productUrl ?? null,
        createdByUserId: BigInt(userId),
        isActive: dto.isActive ?? true,
      },
    });
    return this.toProductResponse(created);
  }

  private readonly categorySelect = {
    id: true,
    organizationId: true,
    parentId: true,
    name: true,
    sortOrder: true,
    isActive: true,
    createdAt: true,
  } as const;

  private listOrderBy(
    sort?: ProductListSort,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const s = sort ?? ProductListSort.CreatedAtDesc;
    switch (s) {
      case ProductListSort.PriceAsc:
        return [{ price: 'asc' }, { id: 'asc' }];
      case ProductListSort.PriceDesc:
        return [{ price: 'desc' }, { id: 'desc' }];
      case ProductListSort.PurchaseCountDesc:
        return [{ purchaseCountCache: 'desc' }, { id: 'desc' }];
      case ProductListSort.CreatedAtDesc:
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  private async resolveCategoryFilter(
    query: ProductListQueryDto,
    organizationId: number,
  ): Promise<Prisma.ProductWhereInput['categoryId']> {
    if (query.parentCategoryId == null) {
      if (query.categoryId == null) {
        return undefined;
      }
      return BigInt(query.categoryId);
    }

    const allCats = await this.prisma.category.findMany({
      where: { organizationId: BigInt(organizationId) },
      select: { id: true, parentId: true },
    });
    const subtree = collectCategorySubtreeIds(
      allCats,
      BigInt(query.parentCategoryId),
    );
    if (subtree == null) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '카테고리를 찾을 수 없습니다.',
      );
    }

    if (query.categoryId != null) {
      const leaf = BigInt(query.categoryId);
      if (!subtree.some((id) => id === leaf)) {
        throw new AppException(
          ErrorCode.BAD_REQUEST,
          'categoryId가 parentCategoryId 하위 트리에 속하지 않습니다.',
        );
      }
      return leaf;
    }

    return { in: subtree };
  }

  /** 목록: category 포함, 정렬·mine·상위 카테고리 트리 필터 지원 */
  async findAll(
    organizationId: number,
    query: ProductListQueryDto,
    currentUserId: number,
  ): Promise<{
    data: ProductResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId: BigInt(organizationId),
    };

    const catFilter = await this.resolveCategoryFilter(query, organizationId);
    if (catFilter !== undefined) {
      where.categoryId = catFilter;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.keyword?.trim()) {
      where.name = { contains: query.keyword.trim() };
    }
    if (query.mine === true) {
      where.createdByUserId = BigInt(currentUserId);
    }

    const orderBy = this.listOrderBy(query.sort);

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: this.categorySelect },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: list.map((row) => this.toProductResponse(row as ProductRow)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** detail 조회: category include */
  async findOne(
    organizationId: number,
    productId: number,
  ): Promise<ProductResponseDto | null> {
    const row = await this.prisma.product.findFirst({
      where: {
        id: BigInt(productId),
        organizationId: BigInt(organizationId),
      },
      include: {
        category: { select: this.categorySelect },
      },
    });
    return row ? this.toProductResponse(row) : null;
  }

  async update(
    organizationId: number,
    productId: number,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const existing = await this.prisma.product.findFirst({
      where: {
        id: BigInt(productId),
        organizationId: BigInt(organizationId),
      },
    });
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '상품을 찾을 수 없습니다.',
      );
    }

    if (dto.categoryId !== undefined && dto.categoryId != null) {
      const cat = await this.prisma.category.findFirst({
        where: {
          id: BigInt(dto.categoryId),
          organizationId: BigInt(organizationId),
        },
      });
      if (!cat) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '카테고리를 찾을 수 없습니다.',
        );
      }
    }

    const data: Prisma.ProductUpdateInput = {};
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        data.category = { disconnect: true };
      } else {
        data.category = { connect: { id: BigInt(dto.categoryId) } };
      }
    }
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.imageKey !== undefined) data.imageKey = dto.imageKey;
    if (dto.productUrl !== undefined) data.productUrl = dto.productUrl;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.product.update({
      where: { id: BigInt(productId) },
      data,
      include: {
        category: { select: this.categorySelect },
      },
    });
    return this.toProductResponse(updated);
  }

  /** soft delete: is_active = false */
  async remove(organizationId: number, productId: number): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: {
        id: BigInt(productId),
        organizationId: BigInt(organizationId),
      },
    });
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '상품을 찾을 수 없습니다.',
      );
    }
    await this.prisma.product.update({
      where: { id: BigInt(productId) },
      data: { isActive: false },
    });
  }
}
