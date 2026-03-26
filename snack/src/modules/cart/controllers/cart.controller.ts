import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CartService } from '../services/cart.service';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemQuantityDto } from '../dto/update-cart-item-quantity.dto';
import { CartResponseDto } from '../dto/cart-response.dto';
import { OrganizationId } from '../../catalog/decorators/catalog-context.decorator';
import { UserId } from '../../catalog/decorators/catalog-context.decorator';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: '장바구니 조회 (buyer org + user)' })
  @ApiResponse({
    status: 200,
    description: '카트 및 아이템 목록',
    type: CartResponseDto,
  })
  getMyCart(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
  ) {
    return this.cartService.getMyCart(organizationId, userId);
  }

  @Post('items')
  @ApiOperation({
    summary: '장바구니 상품 추가 (동일 상품이면 수량 합산)',
  })
  @ApiResponse({
    status: 201,
    description: '추가 후 전체 장바구니',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 400, description: '비활성 상품 등' })
  @ApiResponse({ status: 404, description: '상품 없음' })
  addItem(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(organizationId, userId, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: '장바구니 상품 수량 변경' })
  @ApiResponse({
    status: 200,
    description: '변경 후 전체 장바구니',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 404, description: '카트 또는 항목 없음' })
  updateItemQuantity(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartItemQuantityDto,
  ) {
    return this.cartService.updateItemQuantity(
      organizationId,
      userId,
      itemId,
      dto,
    );
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '장바구니 상품 삭제' })
  @ApiResponse({ status: 204, description: '삭제됨' })
  @ApiResponse({ status: 404, description: '카트 또는 항목 없음' })
  async removeItem(
    @OrganizationId() organizationId: number,
    @UserId() userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    await this.cartService.removeItem(organizationId, userId, itemId);
  }
}
