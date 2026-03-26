import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AddCartItemDto } from '../dto/add-cart-item.dto';
import { UpdateCartItemQuantityDto } from '../dto/update-cart-item-quantity.dto';
import {
  CartItemResponseDto,
  CartProductSummaryDto,
  CartResponseDto,
} from '../dto/cart-response.dto';

const productSummarySelect = {
  id: true,
  organizationId: true,
  categoryId: true,
  name: true,
  price: true,
  imageKey: true,
  productUrl: true,
  isActive: true,
} as const;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private toProductSummary(p: {
    id: bigint;
    organizationId: bigint;
    categoryId: bigint | null;
    name: string;
    price: Prisma.Decimal;
    imageKey: string | null;
    productUrl: string | null;
    isActive: boolean;
  }): CartProductSummaryDto {
    return {
      id: Number(p.id),
      organizationId: Number(p.organizationId),
      categoryId: p.categoryId != null ? Number(p.categoryId) : null,
      name: p.name,
      price: typeof p.price === 'string' ? p.price : String(p.price),
      imageKey: p.imageKey,
      productUrl: p.productUrl,
      isActive: p.isActive,
    };
  }

  private toItemResponse(row: {
    id: bigint;
    productId: bigint;
    quantity: number;
    createdAt: Date;
    product: {
      id: bigint;
      organizationId: bigint;
      categoryId: bigint | null;
      name: string;
      price: Prisma.Decimal;
      imageKey: string | null;
      productUrl: string | null;
      isActive: boolean;
    };
  }): CartItemResponseDto {
    return {
      id: Number(row.id),
      productId: Number(row.productId),
      quantity: row.quantity,
      createdAt: row.createdAt.toISOString(),
      product: this.toProductSummary(row.product),
    };
  }

  private toCartResponse(
    organizationId: number,
    userId: number,
    cart: {
      id: bigint;
      createdAt: Date;
      updatedAt: Date;
      items: Array<{
        id: bigint;
        productId: bigint;
        quantity: number;
        createdAt: Date;
        product: {
          id: bigint;
          organizationId: bigint;
          categoryId: bigint | null;
          name: string;
          price: Prisma.Decimal;
          imageKey: string | null;
          productUrl: string | null;
          isActive: boolean;
        };
      }>;
    } | null,
  ): CartResponseDto {
    if (!cart) {
      return {
        id: null,
        organizationId,
        userId,
        createdAt: null,
        updatedAt: null,
        items: [],
      };
    }
    return {
      id: Number(cart.id),
      organizationId,
      userId,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
      items: cart.items.map((i) => this.toItemResponse(i)),
    };
  }

  private async findCartWithItems(organizationId: number, userId: number) {
    return this.prisma.cart.findUnique({
      where: {
        organizationId_userId: {
          organizationId: BigInt(organizationId),
          userId: BigInt(userId),
        },
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            product: { select: productSummarySelect },
          },
        },
      },
    });
  }

  /** 장바구니 조회 (없으면 빈 목록) */
  async getMyCart(
    organizationId: number,
    userId: number,
  ): Promise<CartResponseDto> {
    const cart = await this.findCartWithItems(organizationId, userId);
    return this.toCartResponse(organizationId, userId, cart);
  }

  /** 카트 없으면 생성 후 반환 */
  private async getOrCreateCart(organizationId: number, userId: number) {
    const existing = await this.prisma.cart.findUnique({
      where: {
        organizationId_userId: {
          organizationId: BigInt(organizationId),
          userId: BigInt(userId),
        },
      },
    });
    if (existing) return existing;
    return this.prisma.cart.create({
      data: {
        organizationId: BigInt(organizationId),
        userId: BigInt(userId),
      },
    });
  }

  /** 상품 추가 (동일 상품이면 수량 합산) */
  async addItem(
    organizationId: number,
    userId: number,
    dto: AddCartItemDto,
  ): Promise<CartResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: BigInt(dto.productId) },
    });
    if (!product) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '상품을 찾을 수 없습니다.',
      );
    }
    if (!product.isActive) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        '판매 중이 아닌 상품은 담을 수 없습니다.',
      );
    }

    const qty = dto.quantity ?? 1;
    const cart = await this.getOrCreateCart(organizationId, userId);

    const existingLine = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: BigInt(dto.productId),
        },
      },
    });

    if (existingLine) {
      await this.prisma.cartItem.update({
        where: { id: existingLine.id },
        data: { quantity: existingLine.quantity + qty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: BigInt(dto.productId),
          quantity: qty,
        },
      });
    }

    const full = await this.findCartWithItems(organizationId, userId);
    return this.toCartResponse(organizationId, userId, full);
  }

  /** 라인 수량 변경 */
  async updateItemQuantity(
    organizationId: number,
    userId: number,
    itemId: number,
    dto: UpdateCartItemQuantityDto,
  ): Promise<CartResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: {
        organizationId_userId: {
          organizationId: BigInt(organizationId),
          userId: BigInt(userId),
        },
      },
    });
    if (!cart) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '장바구니를 찾을 수 없습니다.',
      );
    }

    const line = await this.prisma.cartItem.findFirst({
      where: {
        id: BigInt(itemId),
        cartId: cart.id,
      },
    });
    if (!line) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '장바구니 항목을 찾을 수 없습니다.',
      );
    }

    await this.prisma.cartItem.update({
      where: { id: line.id },
      data: { quantity: dto.quantity },
    });

    const full = await this.findCartWithItems(organizationId, userId);
    return this.toCartResponse(organizationId, userId, full);
  }

  /** 라인 삭제 */
  async removeItem(
    organizationId: number,
    userId: number,
    itemId: number,
  ): Promise<void> {
    const cart = await this.prisma.cart.findUnique({
      where: {
        organizationId_userId: {
          organizationId: BigInt(organizationId),
          userId: BigInt(userId),
        },
      },
    });
    if (!cart) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '장바구니를 찾을 수 없습니다.',
      );
    }

    const line = await this.prisma.cartItem.findFirst({
      where: {
        id: BigInt(itemId),
        cartId: cart.id,
      },
    });
    if (!line) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '장바구니 항목을 찾을 수 없습니다.',
      );
    }

    await this.prisma.cartItem.delete({
      where: { id: line.id },
    });
  }
}
