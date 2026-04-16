import { Injectable } from '@nestjs/common';
import {
  OrgRole,
  Prisma,
  PurchaseRequestStatus,
  purchase_orders_status,
  type PurchaseRequest,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { CreatePurchaseRequestDto } from '../dto/create-purchase-request.dto';
import { PurchaseRequestListQueryDto } from '../dto/purchase-request-list-query.dto';
import { PurchaseRequestListSort } from '../dto/purchase-request-list-sort.enum';
import {
  PurchaseRequestDetailResponseDto,
  PurchaseRequestItemResponseDto,
  PurchaseRequestSummaryResponseDto,
} from '../dto/purchase-request-response.dto';
import { releaseActiveBudgetReservationsForPurchaseOrders } from '../../finance/utils/release-budget-reservations.util';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { SellerOrderService } from '../../seller-order/services/seller-order.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly sellerOrderService: SellerOrderService,
  ) {}

  private isBuyerOrgAdmin(role: OrgRole): boolean {
    return role === OrgRole.ADMIN || role === OrgRole.SUPER_ADMIN;
  }

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private toItemDto(
    row: RequestWithItems['purchase_request_items'][0],
  ): PurchaseRequestItemResponseDto {
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

  async createFromCart(
    buyerOrganizationId: number,
    requesterUserId: number,
    dto: CreatePurchaseRequestDto,
    currentUser: JwtPayload,
  ): Promise<PurchaseRequestDetailResponseDto> {
    if (
      dto.instantCheckout === true &&
      !this.isBuyerOrgAdmin(currentUser.role)
    ) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        '즉시 구매는 관리자만 요청할 수 있습니다.',
      );
    }

    return this.prisma
      .$transaction(async (tx) => {
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
      })
      .then(async (detail) => {
        await this.auditLog.log({
          organizationId: BigInt(buyerOrganizationId),
          actorUserId: BigInt(requesterUserId),
          action: 'PURCHASE_REQUEST_CREATE',
          targetType: 'purchase_request',
          targetId: BigInt(detail.id),
          message: null,
          metadata: {
            itemCount: detail.items.length,
            instantCheckout: dto.instantCheckout === true,
          },
        });

        if (dto.instantCheckout === true) {
          await this.sellerOrderService.instantCheckoutSelfSellerOrders(
            buyerOrganizationId,
            currentUser,
            detail.id,
            dto.instantShippingFee ?? null,
          );
          const refreshed = await this.findOne(
            buyerOrganizationId,
            requesterUserId,
            detail.id,
            currentUser.role,
          );
          return refreshed ?? detail;
        }

        return detail;
      });
  }

  async findAll(
    buyerOrganizationId: number,
    requesterUserId: number,
    query: PurchaseRequestListQueryDto,
    memberRole: OrgRole,
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
      ...(this.isBuyerOrgAdmin(memberRole)
        ? {}
        : { requesterUserId: BigInt(requesterUserId) }),
      ...(query.status != null && { status: query.status }),
    };

    const sort = query.sort ?? PurchaseRequestListSort.RequestedAtDesc;
    let orderBy: Prisma.PurchaseRequestOrderByWithRelationInput[];
    switch (sort) {
      case PurchaseRequestListSort.TotalAmountAsc:
        orderBy = [{ totalAmount: 'asc' }, { id: 'asc' }];
        break;
      case PurchaseRequestListSort.TotalAmountDesc:
        orderBy = [{ totalAmount: 'desc' }, { id: 'desc' }];
        break;
      case PurchaseRequestListSort.RequestedAtDesc:
      default:
        orderBy = [{ requestedAt: 'desc' }, { id: 'desc' }];
        break;
    }

    const [rows, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        orderBy,
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
    memberRole: OrgRole,
  ): Promise<PurchaseRequestDetailResponseDto | null> {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: {
        id: BigInt(id),
        buyerOrganizationId: BigInt(buyerOrganizationId),
        ...(this.isBuyerOrgAdmin(memberRole)
          ? {}
          : { requesterUserId: BigInt(requesterUserId) }),
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
    memberRole: OrgRole,
  ): Promise<PurchaseRequestDetailResponseDto> {
    const existing = await this.prisma.purchaseRequest.findFirst({
      where: {
        id: BigInt(id),
        buyerOrganizationId: BigInt(buyerOrganizationId),
        ...(this.isBuyerOrgAdmin(memberRole)
          ? {}
          : { requesterUserId: BigInt(requesterUserId) }),
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

    const blockingPo = await this.prisma.purchase_orders.findFirst({
      where: {
        purchase_request_id: existing.id,
        status: purchase_orders_status.PURCHASED,
      },
    });
    if (blockingPo) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '이미 구매 완료된 주문이 있어 구매 요청을 취소할 수 없습니다.',
      );
    }

    const detail = await this.prisma.$transaction(async (tx) => {
      const posToCancel = await tx.purchase_orders.findMany({
        where: {
          purchase_request_id: existing.id,
          status: {
            in: [
              purchase_orders_status.PENDING_SELLER_APPROVAL,
              purchase_orders_status.APPROVED,
            ],
          },
        },
        select: { id: true },
      });

      await tx.purchase_orders.updateMany({
        where: {
          purchase_request_id: existing.id,
          status: {
            in: [
              purchase_orders_status.PENDING_SELLER_APPROVAL,
              purchase_orders_status.APPROVED,
            ],
          },
        },
        data: {
          status: purchase_orders_status.CANCELED,
          updated_at: new Date(),
        },
      });

      await releaseActiveBudgetReservationsForPurchaseOrders(
        tx,
        posToCancel.map((p) => p.id),
      );

      const updated = await tx.purchaseRequest.update({
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
    });

    await this.auditLog.log({
      organizationId: BigInt(buyerOrganizationId),
      actorUserId: BigInt(requesterUserId),
      action: 'PURCHASE_REQUEST_CANCEL',
      targetType: 'purchase_request',
      targetId: BigInt(id),
      message: null,
      metadata: null,
    });

    return detail;
  }
}
