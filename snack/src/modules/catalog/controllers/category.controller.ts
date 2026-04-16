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
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { assertOrgAdmin } from '../../finance/utils/assert-org-admin.util';
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryListQueryDto } from '../dto/category-list-query.dto';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { OrganizationId } from '../decorators/catalog-context.decorator';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '카테고리 등록',
    description:
      '**권한:** ADMIN · SUPER_ADMIN. 현재 JWT 조직 범위에 카테고리가 생성됩니다.',
  })
  @ApiResponse({
    status: 201,
    description: '등록됨',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: 400, description: '검증 실패' })
  @ApiResponse({ status: 404, description: '부모 카테고리 없음' })
  create(
    @CurrentUser() user: JwtPayload,
    @OrganizationId() organizationId: number,
    @Body() dto: CreateCategoryDto,
  ) {
    assertOrgAdmin(user, '카테고리 등록은 관리자만 가능합니다.');
    return this.categoryService.create(dto, organizationId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '카테고리 목록 조회',
    description:
      'JWT `organizationId` 범위의 카테고리만. `parentId` 쿼리로 상·하위 필터.',
  })
  @ApiResponse({
    status: 200,
    description: '목록',
    type: [CategoryResponseDto],
  })
  findAll(
    @OrganizationId() organizationId: number,
    @Query() query: CategoryListQueryDto,
  ) {
    return this.categoryService.findAll(query, organizationId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '카테고리 단건 조회',
    description: '동일 조직 소속 카테고리만 조회됩니다.',
  })
  @ApiResponse({ status: 200, description: '단건', type: CategoryResponseDto })
  @ApiResponse({ status: 404, description: '없음' })
  async findOne(
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const one = await this.categoryService.findOne(id, organizationId);
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
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    assertOrgAdmin(user, '카테고리 수정은 관리자만 가능합니다.');
    return this.categoryService.update(id, dto, organizationId);
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
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertOrgAdmin(user, '카테고리 삭제는 관리자만 가능합니다.');
    await this.categoryService.remove(id, organizationId);
  }
}
