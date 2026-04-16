import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { assertOrgAdmin } from '../../finance/utils/assert-org-admin.util';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductListQueryDto } from '../dto/product-list-query.dto';
import { ProductResponseDto } from '../dto/product-response.dto';
import { OrganizationId } from '../decorators/catalog-context.decorator';
import { UserId } from '../decorators/catalog-context.decorator';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: '상품 등록 (organizationId/userId 주입)' })
  @ApiResponse({ status: 201, description: '등록됨', type: ProductResponseDto })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 404, description: '카테고리 없음' })
  create(
    @Body() dto: CreateProductDto,
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
  ) {
    return this.productService.create(dto, organizationId, userId);
  }

  @Get()
  @ApiOperation({
    summary: '상품 목록 조회',
    description: [
      '조직(`organizationId`) 범위 내 상품. 페이지네이션·키워드·활성 필터.',
      '',
      '- **sort**: `createdAt_desc`(기본), `purchaseCount_desc`, `price_asc`, `price_desc`',
      '- **parentCategoryId**: 해당 카테고리 및 모든 하위 카테고리에 속한 상품',
      '- **categoryId**와 함께 쓰면 하위 트리 ∩ 단일 카테고리',
      '- **mine**: 내가 등록한 상품만',
      '- 응답 항목에 **category** 객체 포함 (상·하위 카테고리명 표시용)',
    ].join('\n'),
  })
  @ApiResponse({ status: 200, description: '목록 + 메타' })
  @ApiResponse({ status: 404, description: 'parentCategoryId가 존재하지 않음' })
  findAll(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Query() query: ProductListQueryDto,
  ) {
    return this.productService.findAll(organizationId, query, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '상품 상세 조회 (category 포함)' })
  @ApiResponse({ status: 200, description: '상세', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: '없음' })
  async findOne(
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const one = await this.productService.findOne(organizationId, id);
    if (!one) {
      throw new NotFoundException('상품을 찾을 수 없습니다.');
    }
    return one;
  }

  @Patch(':id')
  @ApiOperation({
    summary: '상품 수정',
    description:
      '**권한:** 조직 ADMIN · SUPER_ADMIN. 동일 조직 소유 상품만 수정 가능합니다.',
  })
  @ApiResponse({ status: 200, description: '수정됨', type: ProductResponseDto })
  @ApiResponse({ status: 403, description: '일반 멤버(MEMBER)는 수정 불가' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  update(
    @CurrentUser() user: JwtPayload,
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    assertOrgAdmin(user, '상품 수정은 관리자만 가능합니다.');
    return this.productService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: '상품 삭제 (soft delete)',
    description: '`is_active=false` 처리. **권한:** 조직 ADMIN · SUPER_ADMIN.',
  })
  @ApiResponse({ status: 204, description: '삭제됨' })
  @ApiResponse({ status: 403, description: '일반 멤버(MEMBER)는 삭제 불가' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertOrgAdmin(user, '상품 삭제는 관리자만 가능합니다.');
    await this.productService.remove(organizationId, id);
  }
}
