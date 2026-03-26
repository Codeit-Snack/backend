import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PurchaseRequestStatus,
  purchase_orders_status,
  type PurchaseRequest,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { CreatePurchaseRequestDto } from '../dto/create-purchase-request.dto';
import { PurchaseRequestListQueryDto } from '../dto/purchase-request-list-query.dto';
import {
  PurchaseRequestDetailResponseDto,
  PurchaseRequestItemResponseDto,
  PurchaseRequestSummaryResponseDto,
} from '../dto/purchase-request-response.dto';

/** purchase_request_items 모델은 스키마 필드가 snake_case */
type RequestWithItems = PurchaseRequest & {
  purchase_request_items: Array<{
    id: bigint;
    seller_organization_id: bigint;
    product_id: bigint | null;
    product_name_snapshot: string;
    product_url_snapshot: string | null;
    unit_price_snapshot: Prisma.Decimal;
    quantity: number;
    line_total: Prisma.Decimal;
    created_at: Date;
  }>;
};

const CANCELABLE_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.OPEN,
  PurchaseRequestStatus.PARTIALLY_APPROVED,
  PurchaseRequestStatus.READY_TO_PURCHASE,
];

@Injectable()
export class PurchaseRequestService {
  constructor(private readonly prisma: PrismaService) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private toItemDto(row: RequestWithItems['purchase_request_items'][0]): PurchaseRequestItemResponseDto {
    return {
      id: Number(row.id),
      sellerOrganizationId: Number(row.seller_organization_id),
      productId: row.product_id != null ? Number(row.product_id) : null,
      productNameSnapshot: row.product_name_snapshot,
      productUrlSnapshot: row.product_url_snapshot,
      unitPriceSnapshot: this.decStr(row.unit_price_snapshot),
      quantity: row.quantity,
      lineTotal: this.decStr(row.line_total),
      createdAt: row.created_at.toISOString(),
    };
  }

  private toSummary(
    row: PurchaseRequest & {
      _count?: { purchase_request_items: number };
    },
  ): PurchaseRequestSummaryResponseDto {
    return {
      id: Number(row.id),
      status: row.status,
      totalAmount: this.decStr(row.totalAmount),
      requestedAt: row.requestedAt.toISOString(),
      canceledAt: row.canceledAt?.toISOString() ?? null,
      itemCount: row._count?.purchase_request_items ?? 0,
    };
  }

  private toDetail(row: RequestWithItems): PurchaseRequestDetailResponseDto {
    return {
      id: Number(row.id),
      buyerOrganizationId: Number(row.buyerOrganizationId),
      requesterUserId: Number(row.requesterUserId),
      status: row.status,
      requestMessage: row.requestMessage,
      totalAmount: this.decStr(row.totalAmount),
      requestedAt: row.requestedAt.toISOString(),
      canceledAt: row.canceledAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      itemCount: row.purchase_request_items.length,
      items: row.purchase_request_items.map((i) => this.toItemDto(i)),
    };
  }

  /** 장바구니 → 스냅샷 라인 생성 후 카트 비움 */
  async createFromCart(
    buyerOrganizationId: number,
    requesterUserId: number,
    dto: CreatePurchaseRequestDto,
  ): Promise<PurchaseRequestDetailResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: {
          organizationId_userId: {
            organizationId: BigInt(buyerOrganizationId),
            userId: BigInt(requesterUserId),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new AppException(
          ErrorCode.BAD_REQUEST,
          '장바구니가 비어 있습니다.',
        );
      }

      for (const line of cart.items) {
        if (!line.product.isActive) {
          throw new AppException(
            ErrorCode.BAD_REQUEST,
            `판매 중이 아닌 상품이 포함되어 있습니다: ${line.product.name}`,
          );
        }
      }

      const linePayloads = cart.items.map((line) => {
        const unit = new Prisma.Decimal(line.product.price);
        const lineTotal = unit.mul(line.quantity);
        return {
          sellerOrganizationId: line.product.organizationId,
          productId: line.productId,
          productNameSnapshot: line.product.name,
          productUrlSnapshot: line.product.productUrl,
          unitPriceSnapshot: unit,
          quantity: line.quantity,
          lineTotal,
        };
      });

      let totalAmount = new Prisma.Decimal(0);
      for (const p of linePayloads) {
        totalAmount = totalAmount.add(p.lineTotal);
      }

      const created = await tx.purchaseRequest.create({
        data: {
          buyerOrganizationId: BigInt(buyerOrganizationId),
          requesterUserId: BigInt(requesterUserId),
          status: PurchaseRequestStatus.OPEN,
          requestMessage: dto.requestMessage ?? null,
          totalAmount,
          purchase_request_items: {
            create: linePayloads.map((p) => ({
              seller_organization_id: p.sellerOrganizationId,
              product_id: p.productId,
              product_name_snapshot: p.productNameSnapshot,
              product_url_snapshot: p.productUrlSnapshot,
              unit_price_snapshot: p.unitPriceSnapshot,
              quantity: p.quantity,
              line_total: p.lineTotal,
            })),
          },
        },
        include: {
          purchase_request_items: {
            orderBy: { id: 'asc' },
          },
        },
      });

      const sellerTotals = new Map<string, Prisma.Decimal>();
      for (const p of linePayloads) {
        const key = p.sellerOrganizationId.toString();
        const prev = sellerTotals.get(key) ?? new Prisma.Decimal(0);
        sellerTotals.set(key, prev.add(p.lineTotal));
      }
      for (const [sellerKey, itemsAmount] of sellerTotals) {
        await tx.purchase_orders.create({
          data: {
            purchase_request_id: created.id,
            buyer_organization_id: BigInt(buyerOrganizationId),
            seller_organization_id: BigInt(sellerKey),
            status: purchase_orders_status.PENDING_SELLER_APPROVAL,
            items_amount: itemsAmount,
          },
        });
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return this.toDetail(created as unknown as RequestWithItems);
    });
  }

  async findAll(
    buyerOrganizationId: number,
    requesterUserId: number,
    query: PurchaseRequestListQueryDto,
  ): Promise<{
    data: PurchaseRequestSummaryResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseRequestWhereInput = {
      buyerOrganizationId: BigInt(buyerOrganizationId),
      requesterUserId: BigInt(requesterUserId),
      ...(query.status != null && { status: query.status }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { purchase_request_items: true } },
        },
      }),
      this.prisma.purchaseRequest.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toSummary(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(
    buyerOrganizationId: number,
    requesterUserId: number,
    id: number,
  ): Promise<PurchaseRequestDetailResponseDto | null> {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: {
        id: BigInt(id),
        buyerOrganizationId: BigInt(buyerOrganizationId),
        requesterUserId: BigInt(requesterUserId),
      },
      include: {
        purchase_request_items: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return row ? this.toDetail(row as unknown as RequestWithItems) : null;
  }

  async cancel(
    buyerOrganizationId: number,
    requesterUserId: number,
    id: number,
  ): Promise<PurchaseRequestDetailResponseDto> {
    const existing = await this.prisma.purchaseRequest.findFirst({
      where: {
        id: BigInt(id),
        buyerOrganizationId: BigInt(buyerOrganizationId),
        requesterUserId: BigInt(requesterUserId),
      },
      include: {
        purchase_request_items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!existing) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '구매 요청을 찾을 수 없습니다.',
      );
    }

    if (!CANCELABLE_STATUSES.includes(existing.status)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '현재 상태에서는 취소할 수 없습니다.',
      );
    }

    const updated = await this.prisma.purchaseRequest.update({
      where: { id: existing.id },
      data: {
        status: PurchaseRequestStatus.CANCELED,
        canceledAt: new Date(),
      },
      include: {
        purchase_request_items: {
          orderBy: { id: 'asc' },
        },
      },
    });

    return this.toDetail(updated as unknown as RequestWithItems);
  }
}
