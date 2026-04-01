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
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { assertOrgAdmin } from '@/modules/finance/utils/assert-org-admin.util';
import { CategoryService } from '@/modules/catalog/services/category.service';
import { CreateCategoryDto } from '@/modules/catalog/dto/create-category.dto';
import { UpdateCategoryDto } from '@/modules/catalog/dto/update-category.dto';
import { CategoryListQueryDto } from '@/modules/catalog/dto/category-list-query.dto';
import { CategoryResponseDto } from '@/modules/catalog/dto/category-response.dto';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '카테고리 등록 (조직 ADMIN 이상)' })
  @ApiResponse({
    status: 201,
    description: '등록됨',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 404, description: '부모 카테고리 없음' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateCategoryDto) {
    assertOrgAdmin(user, '카테고리 등록은 관리자만 가능합니다.');
    return this.categoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '카테고리 목록 조회 (parentId 필터 지원)' })
  @ApiResponse({
    status: 200,
    description: '목록',
    type: [CategoryResponseDto],
  })
  findAll(@Query() query: CategoryListQueryDto) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '카테고리 단건 조회' })
  @ApiResponse({ status: 200, description: '단건', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: '없음' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const one = await this.categoryService.findOne(id);
    if (!one) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }
    return one;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '카테고리 수정 (조직 ADMIN 이상)' })
  @ApiResponse({
    status: 200,
    description: '수정됨',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: '카테고리 없음' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    assertOrgAdmin(user, '카테고리 수정은 관리자만 가능합니다.');
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '카테고리 삭제 (조직 ADMIN 이상, 하위/연결 상품 있으면 불가)',
  })
  @ApiResponse({ status: 204, description: '삭제됨' })
  @ApiResponse({ status: 404, description: '카테고리 없음' })
  @ApiResponse({
    status: 409,
    description: '하위 카테고리 또는 연결 상품 있음',
  })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertOrgAdmin(user, '카테고리 삭제는 관리자만 가능합니다.');
    await this.categoryService.remove(id);
  }
}
