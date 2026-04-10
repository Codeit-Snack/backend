import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
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
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { PurchaseRequestService } from '@/modules/purchase-request/services/purchase-request.service';
import { CreatePurchaseRequestDto } from '@/modules/purchase-request/dto/create-purchase-request.dto';
import { PurchaseRequestListQueryDto } from '@/modules/purchase-request/dto/purchase-request-list-query.dto';
import { PurchaseRequestDetailResponseDto } from '@/modules/purchase-request/dto/purchase-request-response.dto';
import { OrganizationId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { UserId } from '@/modules/catalog/decorators/catalog-context.decorator';

@ApiTags('PurchaseRequest')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('purchase-requests')
export class PurchaseRequestController {
  constructor(
    private readonly purchaseRequestService: PurchaseRequestService,
  ) {}

  @Post()
  @ApiOperation({
    summary: '구매 요청 생성 (현재 장바구니 → 스냅샷, 이후 카트 비움)',
    description:
      '`instantCheckout`: 관리자 전용. 자체 판매 상품만 있을 때 승인·구매완료·지출까지 한 번에 처리합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '생성됨',
    type: PurchaseRequestDetailResponseDto,
  })
  @ApiResponse({ status: 400, description: '빈 장바구니 / 비활성 상품 / 즉시구매 불가 조합' })
  @ApiResponse({ status: 403, description: '즉시 구매를 MEMBER가 요청' })
  @ApiResponse({ status: 409, description: '즉시 구매 시 예산 부족' })
  create(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.purchaseRequestService.createFromCart(
      buyerOrganizationId,
      requesterUserId,
      dto,
      currentUser,
    );
  }

  @Get()
  @ApiOperation({
    summary:
      '구매 요청 목록 (바이어 org). MEMBER는 본인이 요청한 건만, ADMIN/SUPER_ADMIN은 조직 전체',
    description:
      '**sort** 쿼리: `requestedAt_desc`(기본), `totalAmount_asc`, `totalAmount_desc`.',
  })
  @ApiResponse({ status: 200, description: '목록 + 페이지 메타' })
  findAll(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: PurchaseRequestListQueryDto,
  ) {
    return this.purchaseRequestService.findAll(
      buyerOrganizationId,
      requesterUserId,
      query,
      currentUser.role,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '구매 요청 상세' })
  @ApiResponse({
    status: 200,
    description: '상세',
    type: PurchaseRequestDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '없음' })
  async findOne(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const one = await this.purchaseRequestService.findOne(
      buyerOrganizationId,
      requesterUserId,
      id,
      currentUser.role,
    );
    if (!one) {
      throw new NotFoundException('구매 요청을 찾을 수 없습니다.');
    }
    return one;
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      '구매 요청 취소 (OPEN / PARTIALLY_APPROVED / READY_TO_PURCHASE). 요청자 또는 조직 ADMIN/SUPER_ADMIN',
  })
  @ApiResponse({
    status: 200,
    description: '취소 후 상세',
    type: PurchaseRequestDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '없음' })
  @ApiResponse({ status: 409, description: '취소 불가 상태' })
  cancel(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchaseRequestService.cancel(
      buyerOrganizationId,
      requesterUserId,
      id,
      currentUser.role,
    );
  }
}
