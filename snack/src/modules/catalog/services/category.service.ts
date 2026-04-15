import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
import { DEFAULT_ORGANIZATION_CATEGORY_TREE } from '@/modules/catalog/constants/default-organization-categories';
import { CreateCategoryDto } from '@/modules/catalog/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/catalog/dto/update-category.dto';
import { CategoryListQueryDto } from '@/modules/catalog/dto/category-list-query.dto';
import { CategoryResponseDto } from '@/modules/catalog/dto/category-response.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** list 조회용: select만, relation 미포함 */
  private toCategoryResponse(row: {
    id: bigint;
    organizationId: bigint;
    parentId: bigint | null;
    name: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
  }): CategoryResponseDto {
    return {
      id: Number(row.id),
      organizationId: Number(row.organizationId),
      parentId: row.parentId != null ? Number(row.parentId) : null,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * 신규 조직에 기본 대·소분류를 한 번에 생성합니다.
   * 필드 규칙은 `create`와 동일하며, 이미 카테고리가 있으면 스킵합니다.
   */
  async seedDefaultCategoriesForOrganization(
    organizationId: bigint | number,
  ): Promise<void> {
    const orgId =
      typeof organizationId === 'bigint'
        ? organizationId
        : BigInt(organizationId);

    const existing = await this.prisma.category.count({
      where: { organizationId: orgId },
    });
    if (existing > 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      let majorOrder = 0;
      for (const { major, minors } of DEFAULT_ORGANIZATION_CATEGORY_TREE) {
        const parent = await tx.category.create({
          data: {
            organizationId: orgId,
            parentId: null,
            name: major,
            sortOrder: majorOrder,
            isActive: true,
          },
        });
        majorOrder += 1;

        let minorOrder = 0;
        for (const name of minors) {
          await tx.category.create({
            data: {
              organizationId: orgId,
              parentId: parent.id,
              name,
              sortOrder: minorOrder,
              isActive: true,
            },
          });
          minorOrder += 1;
        }
      }
    });
  }

  async create(
    dto: CreateCategoryDto,
    organizationId: number,
  ): Promise<CategoryResponseDto> {
    const orgId = BigInt(organizationId);
    if (dto.parentId != null) {
      const parent = await this.prisma.category.findFirst({
        where: { id: BigInt(dto.parentId), organizationId: orgId },
      });
      if (!parent) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '부모 카테고리를 찾을 수 없습니다.',
        );
      }
    }

    const created = await this.prisma.category.create({
      data: {
        organizationId: orgId,
        parentId: dto.parentId ?? undefined,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toCategoryResponse(created);
  }

  async findAll(
    query: CategoryListQueryDto,
    organizationId: number,
  ): Promise<CategoryResponseDto[]> {
    const orgId = BigInt(organizationId);
    const where: {
      organizationId: bigint;
      parentId?: bigint | null;
    } = { organizationId: orgId };
    if (query.parentId !== undefined && query.parentId !== null) {
      where.parentId = BigInt(query.parentId);
    } else if (query.parentId === null) {
      where.parentId = null;
    }

    const list = await this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    });
    return list.map((row) => this.toCategoryResponse(row));
  }

  async findOne(
    id: number,
    organizationId: number,
  ): Promise<CategoryResponseDto | null> {
    const row = await this.prisma.category.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    });
    return row ? this.toCategoryResponse(row) : null;
  }

  async update(
    id: number,
    dto: UpdateCategoryDto,
    organizationId: number,
  ): Promise<CategoryResponseDto> {
    const orgId = BigInt(organizationId);
    const existing = await this.prisma.category.findFirst({
      where: { id: BigInt(id), organizationId: orgId },
    });
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '카테고리를 찾을 수 없습니다.',
      );
    }

    if (dto.parentId !== undefined && dto.parentId != null) {
      const parent = await this.prisma.category.findFirst({
        where: { id: BigInt(dto.parentId), organizationId: orgId },
      });
      if (!parent) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '부모 카테고리를 찾을 수 없습니다.',
        );
      }
    }

    const updated = await this.prisma.category.update({
      where: { id: BigInt(id) },
      data: {
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    return this.toCategoryResponse(updated);
  }

  async remove(id: number, organizationId: number): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: BigInt(id), organizationId: BigInt(organizationId) },
      include: {
        children: { take: 1 },
        products: { take: 1 },
      },
    });
    if (!category) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '카테고리를 찾을 수 없습니다.',
      );
    }
    if (category.children.length > 0) {
      throw new AppException(
        ErrorCode.CATEGORY_HAS_CHILDREN,
        '하위 카테고리가 있어 삭제할 수 없습니다.',
      );
    }
    if (category.products.length > 0) {
      throw new AppException(
        ErrorCode.CATEGORY_HAS_PRODUCTS,
        '연결된 상품이 있어 삭제할 수 없습니다.',
      );
    }
    await this.prisma.category.delete({
      where: { id: BigInt(id) },
    });
  }
}
