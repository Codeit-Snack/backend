import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
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
    parentId: bigint | null;
    name: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
  }): CategoryResponseDto {
    return {
      id: Number(row.id),
      parentId: row.parentId != null ? Number(row.parentId) : null,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    if (dto.parentId != null) {
      const parent = await this.prisma.category.findUnique({
        where: { id: BigInt(dto.parentId) },
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
        parentId: dto.parentId ?? undefined,
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toCategoryResponse(created);
  }

  async findAll(query: CategoryListQueryDto): Promise<CategoryResponseDto[]> {
    const where: { parentId?: bigint | null } = {};
    if (query.parentId !== undefined && query.parentId !== null) {
      where.parentId = BigInt(query.parentId);
    } else if (query.parentId === null) {
      where.parentId = null;
    }
    // parentId 미전달 시: 전체 조회

    const list = await this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        parentId: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
      },
    });
    return list.map((row) => this.toCategoryResponse(row));
  }

  async findOne(id: number): Promise<CategoryResponseDto | null> {
    const row = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
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
  ): Promise<CategoryResponseDto> {
    const existing = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
    });
    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '카테고리를 찾을 수 없습니다.',
      );
    }

    if (dto.parentId !== undefined && dto.parentId != null) {
      const parent = await this.prisma.category.findUnique({
        where: { id: BigInt(dto.parentId) },
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

  async remove(id: number): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: BigInt(id) },
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
