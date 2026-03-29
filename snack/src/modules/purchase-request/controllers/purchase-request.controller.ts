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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PurchaseRequestService } from '../services/purchase-request.service';
import { CreatePurchaseRequestDto } from '../dto/create-purchase-request.dto';
import { PurchaseRequestListQueryDto } from '../dto/purchase-request-list-query.dto';
import { PurchaseRequestDetailResponseDto } from '../dto/purchase-request-response.dto';
import { OrganizationId } from '../../catalog/decorators/catalog-context.decorator';
import { UserId } from '../../catalog/decorators/catalog-context.decorator';

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
  })
  @ApiResponse({
    status: 201,
    description: '생성됨',
    type: PurchaseRequestDetailResponseDto,
  })
  @ApiResponse({ status: 400, description: '빈 장바구니 / 비활성 상품' })
  create(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @Body() dto: CreatePurchaseRequestDto,
  ) {
    return this.purchaseRequestService.createFromCart(
      buyerOrganizationId,
      requesterUserId,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: '구매 요청 목록 (buyer org + 요청자 본인)' })
  @ApiResponse({ status: 200, description: '목록 + 페이지 메타' })
  findAll(
    @OrganizationId() buyerOrganizationId: number,
    @UserId() requesterUserId: number,
    @Query() query: PurchaseRequestListQueryDto,
  ) {
    return this.purchaseRequestService.findAll(
      buyerOrganizationId,
      requesterUserId,
      query,
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
    @Param('id', ParseIntPipe) id: number,
  ) {
    const one = await this.purchaseRequestService.findOne(
      buyerOrganizationId,
      requesterUserId,
      id,
    );
    if (!one) {
      throw new NotFoundException('구매 요청을 찾을 수 없습니다.');
    }
    return one;
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: '구매 요청 취소 (OPEN / PARTIALLY_APPROVED / READY_TO_PURCHASE)',
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
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.purchaseRequestService.cancel(
      buyerOrganizationId,
      requesterUserId,
      id,
    );
  }
}
