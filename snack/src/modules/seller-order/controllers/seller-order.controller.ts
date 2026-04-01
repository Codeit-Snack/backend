import {
  Body,
  Controller,
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
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OrganizationId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { UserId } from '@/modules/catalog/decorators/catalog-context.decorator';
import { SellerOrderService } from '@/modules/seller-order/services/seller-order.service';
import { SellerOrderListQueryDto } from '@/modules/seller-order/dto/seller-order-list-query.dto';
import { ApproveSellerOrderDto } from '@/modules/seller-order/dto/approve-seller-order.dto';
import { RejectSellerOrderDto } from '@/modules/seller-order/dto/reject-seller-order.dto';
import { RecordPurchaseDto } from '@/modules/seller-order/dto/record-purchase.dto';
import { UpdateShippingDto } from '@/modules/seller-order/dto/update-shipping.dto';

@ApiTags('SellerOrder')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('seller/orders')
export class SellerOrderController {
  constructor(private readonly sellerOrderService: SellerOrderService) {}

  @Get()
  @ApiOperation({
    summary: '판매자 조직 기준 구매 주문(PO) 목록',
    description:
      'JWT의 organizationId가 **판매자 조직**이어야 합니다. 페이지네이션·status 필터.',
  })
  @ApiResponse({
    status: 200,
    description:
      '`{ success, data: { data[], total, page, limit, totalPages } }`',
  })
  @ApiResponse({ status: 401, description: '미인증' })
  list(
    @OrganizationId() organizationId: number,
    @Query() query: SellerOrderListQueryDto,
  ) {
    return this.sellerOrderService.list(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '판매자 주문 상세 (요청 라인·PO 라인·의사결정)' })
  @ApiParam({ name: 'id', description: 'purchase_orders.id' })
  @ApiResponse({ status: 200, description: '`{ success, data }` 상세 객체' })
  @ApiResponse({ status: 404, description: '없거나 다른 판매자 조직 주문' })
  async getOne(
    @OrganizationId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const row = await this.sellerOrderService.findOne(organizationId, id);
    if (!row) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }
    return row;
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: '판매자 승인 (PENDING_SELLER_APPROVAL → APPROVED)',
    description: '구매 요청(PR) 상태가 판매자별 PO에 따라 롤업됩니다.',
  })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '승인 후 상세' })
  @ApiResponse({ status: 409, description: '이미 처리된 상태' })
  approve(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveSellerOrderDto,
  ) {
    return this.sellerOrderService.approve(organizationId, userId, id, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '판매자 거절' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '거절 후 상세' })
  @ApiResponse({ status: 409, description: '대기 상태가 아님' })
  reject(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectSellerOrderDto,
  ) {
    return this.sellerOrderService.reject(organizationId, userId, id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '판매자 취소 (대기·승인 → CANCELED)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '취소 후 상세' })
  @ApiResponse({ status: 409, description: '구매완료 등 취소 불가' })
  cancel(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sellerOrderService.cancel(organizationId, userId, id);
  }

  @Post(':id/record-purchase')
  @ApiOperation({
    summary: '실구매 기록 (APPROVED → PURCHASED)',
    description:
      '해당 판매자의 purchase_request_items로 purchase_order_items를 최초 1회 생성합니다.',
  })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '기록 후 상세' })
  @ApiResponse({ status: 409, description: '승인 상태가 아님' })
  recordPurchase(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPurchaseDto,
  ) {
    return this.sellerOrderService.recordPurchase(
      organizationId,
      userId,
      id,
      dto,
    );
  }

  @Patch(':id/shipping')
  @ApiOperation({
    summary: '배송 상태·배송 완료 시각',
    description: 'PURCHASED 주문만 수정 가능.',
  })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: '갱신 후 상세' })
  @ApiResponse({ status: 400, description: '둘 다 비어 있음' })
  @ApiResponse({ status: 409, description: '구매완료 상태가 아님' })
  updateShipping(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.sellerOrderService.updateShipping(
      organizationId,
      userId,
      id,
      dto,
    );
  }
}
