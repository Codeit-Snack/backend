import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProductDto } from '@/products/dto/create-product.dto';
import { UpdateProductDto } from '@/products/dto/update-product.dto';
import { GetProductsQueryDto } from '@/products/dto/get-products-query.dto';

export type CurrentUser = {
  id: number;
  currentOrganizationId: number;
  role: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateAdminRole(user: CurrentUser) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('상품 관리 권한이 없습니다.');
    }
  }

  private async findProductOrThrow(user: CurrentUser, productId: number) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: BigInt(productId),
        organizationId: BigInt(user.currentOrganizationId),
      },
      include: {
        category: true,
        organization: true,
      },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }

    return product;
  }

  async create(user: CurrentUser, dto: CreateProductDto) {
    this.validateAdminRole(user);

    return this.prisma.product.create({
      data: {
        organizationId: BigInt(user.currentOrganizationId),
        categoryId: dto.categoryId ? BigInt(dto.categoryId) : null,
        name: dto.name,
        price: new Prisma.Decimal(dto.price),
        imageKey: dto.imageKey ?? null,
        productUrl: dto.productUrl ?? null,
        createdByUserId: BigInt(user.id),
        isActive: dto.isActive ?? true,
      },
      include: {
        category: true,
        organization: true,
      },
    });
  }

  async findAll(user: CurrentUser, query: GetProductsQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      organizationId: BigInt(user.currentOrganizationId),
      ...(query.categoryId && { categoryId: BigInt(query.categoryId) }),
      ...(query.isActive !== undefined && {
        isActive: query.isActive,
      }),
      ...(query.keyword && {
        name: {
          contains: query.keyword,
        },
      }),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput = query.sortBy
      ? {
          [query.sortBy]:
            query.order === 'asc' || query.order === 'desc'
              ? query.order
              : 'desc',
        }
      : { createdAt: 'desc' };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          organization: true,
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(user: CurrentUser, productId: number) {
    return this.findProductOrThrow(user, productId);
  }

  async update(user: CurrentUser, productId: number, dto: UpdateProductDto) {
    this.validateAdminRole(user);

    await this.findProductOrThrow(user, productId);

    return this.prisma.product.update({
      where: {
        id: BigInt(productId),
      },
      data: {
        ...(dto.categoryId !== undefined && {
          categoryId: dto.categoryId ? BigInt(dto.categoryId) : null,
        }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.price !== undefined && {
          price: new Prisma.Decimal(dto.price),
        }),
        ...(dto.imageKey !== undefined && { imageKey: dto.imageKey }),
        ...(dto.productUrl !== undefined && { productUrl: dto.productUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        category: true,
        organization: true,
      },
    });
  }

  async remove(user: CurrentUser, productId: number) {
    this.validateAdminRole(user);

    await this.findProductOrThrow(user, productId);

    return this.prisma.product.update({
      where: {
        id: BigInt(productId),
      },
      data: {
        isActive: false,
      },
    });
  }
}
