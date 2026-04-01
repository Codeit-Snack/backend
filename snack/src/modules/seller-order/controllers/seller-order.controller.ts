import {
  Body,
  Controller,
  Get,
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
import { OrganizationId } from '../../catalog/decorators/catalog-context.decorator';
import { SellerOrderService } from '../services/seller-order.service';
import { SellerOrderListQueryDto } from '../dto/seller-order-list-query.dto';
import { ApproveSellerOrderDto } from '../dto/approve-seller-order.dto';
import { RejectSellerOrderDto } from '../dto/reject-seller-order.dto';
import { RecordPurchaseDto } from '../dto/record-purchase.dto';
import { UpdateShippingDto } from '../dto/update-shipping.dto';
import { CancelSellerOrderDto } from '../dto/cancel-seller-order.dto';

@ApiTags('SellerOrders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('seller/purchase-orders')
export class SellerOrderController {
  constructor(private readonly sellerOrderService: SellerOrderService) {}

  @Get()
  @ApiOperation({
    summary: '판매자 주문 목록',
    description:
      'JWT의 organizationId(판매자 조직) 기준. 조회는 조직 소속 멤버 모두 가능.',
  })
  @ApiResponse({ status: 200, description: '페이지네이션 목록' })
  list(
    @OrganizationId() sellerOrganizationId: number,
    @Query() query: SellerOrderListQueryDto,
  ) {
    return this.sellerOrderService.findAll(sellerOrganizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '판매자 주문 상세' })
  @ApiResponse({ status: 404, description: '없음' })
  detail(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sellerOrderService.findOne(sellerOrganizationId, id);
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: '주문 승인',
    description:
      'PENDING_SELLER_APPROVAL → APPROVED. 구매 요청 라인으로 purchase_order_items 생성.',
  })
  approve(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ApproveSellerOrderDto,
  ) {
    return this.sellerOrderService.approve(sellerOrganizationId, id, user, dto);
  }

  @Post(':id/reject')
  @ApiOperation({
    summary: '주문 거절',
    description:
      '동일 구매 요청의 다른 대기 주문은 CANCELED 처리. 구매 요청은 REJECTED로 갱신.',
  })
  reject(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RejectSellerOrderDto,
  ) {
    return this.sellerOrderService.reject(sellerOrganizationId, id, user, dto);
  }

  @Post(':id/record-purchase')
  @ApiOperation({
    summary: '실제 구매 처리',
    description:
      'APPROVED → PURCHASED. 외부 쇼핑몰 주문번호·URL 기록. 플랫폼+외부주문번호 유일.',
  })
  recordPurchase(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordPurchaseDto,
  ) {
    return this.sellerOrderService.recordPurchase(
      sellerOrganizationId,
      id,
      user,
      dto,
    );
  }

  @Patch(':id/shipping')
  @ApiOperation({
    summary: '배송 상태 업데이트',
    description: 'APPROVED 또는 PURCHASED 주문만.',
  })
  updateShipping(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateShippingDto,
  ) {
    return this.sellerOrderService.updateShipping(
      sellerOrganizationId,
      id,
      user,
      dto,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: '판매자 주문 취소',
    description: 'PENDING_SELLER_APPROVAL 또는 APPROVED만 취소 가능.',
  })
  cancel(
    @OrganizationId() sellerOrganizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelSellerOrderDto,
  ) {
    return this.sellerOrderService.cancel(sellerOrganizationId, id, user, dto);
  }
}
