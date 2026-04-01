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
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ProductService } from '@/modules/catalog/services/product.service';
import { CreateProductDto } from '@/modules/catalog/dto/create-product.dto';
import { UpdateProductDto } from '@/modules/catalog/dto/update-product.dto';
import { ProductListQueryDto } from '@/modules/catalog/dto/product-list-query.dto';
import { ProductResponseDto } from '@/modules/catalog/dto/product-response.dto';
import { OrganizationId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { UserId } from '@/modules/catalog/decorators/catalog-context.decorator';

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
    summary: '상품 목록 조회 (organizationId 범위, 페이지네이션·필터)',
  })
  @ApiResponse({ status: 200, description: '목록 + 메타' })
  findAll(
    @OrganizationId() organizationId: number,
    @Query() query: ProductListQueryDto,
  ) {
    return this.productService.findAll(organizationId, query);
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
  @ApiOperation({ summary: '상품 수정 (organizationId 범위 내)' })
  @ApiResponse({ status: 200, description: '수정됨', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: '상품 없음' })
  update(
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '상품 삭제 (soft delete: is_active=false)' })
  @ApiResponse({ status: 204, description: '삭제됨' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  async remove(
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.productService.remove(organizationId, id);
  }
}
