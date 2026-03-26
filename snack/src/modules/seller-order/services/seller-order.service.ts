import { Injectable } from '@nestjs/common';
import {
  OrgRole,
  Prisma,
  PurchaseRequestStatus,
  purchase_order_decisions_decision,
  purchase_orders_status,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { SellerOrderListQueryDto } from '../dto/seller-order-list-query.dto';
import { ApproveSellerOrderDto } from '../dto/approve-seller-order.dto';
import { RejectSellerOrderDto } from '../dto/reject-seller-order.dto';
import { RecordPurchaseDto } from '../dto/record-purchase.dto';
import { UpdateShippingDto } from '../dto/update-shipping.dto';
import { CancelSellerOrderDto } from '../dto/cancel-seller-order.dto';

const MUTABLE_PR_STATUSES: PurchaseRequestStatus[] = [
  PurchaseRequestStatus.OPEN,
  PurchaseRequestStatus.PARTIALLY_APPROVED,
  PurchaseRequestStatus.READY_TO_PURCHASE,
];

@Injectable()
export class SellerOrderService {
  constructor(private readonly prisma: PrismaService) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private assertSellerAdmin(role: OrgRole): void {
    if (role !== OrgRole.ADMIN && role !== OrgRole.SUPER_ADMIN) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        '판매자 주문 처리는 조직 관리자·최고 관리자만 가능합니다.',
      );
    }
  }

  private assertPurchaseRequestMutable(status: PurchaseRequestStatus): void {
    if (!MUTABLE_PR_STATUSES.includes(status)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '구매 요청이 더 이상 처리할 수 없는 상태입니다.',
      );
    }
  }

  /** 구매 요청에 속한 모든 판매자 주문 상태를 구매 요청 상태에 반영 */
  private async rollupPurchaseRequestStatus(
    tx: Prisma.TransactionClient,
    purchaseRequestId: bigint,
  ): Promise<void> {
    const pr = await tx.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      include: { purchase_orders: true },
    });
    if (!pr || pr.status === PurchaseRequestStatus.CANCELED) {
      return;
    }

    const pos = pr.purchase_orders;
    const S = purchase_orders_status;

    if (pos.some((p) => p.status === S.REJECTED)) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.REJECTED },
      });
      return;
    }

    if (pos.length === 0) {
      return;
    }

    if (pos.every((p) => p.status === S.PURCHASED)) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.PURCHASED },
      });
      return;
    }

    if (pos.every((p) => p.status === S.PENDING_SELLER_APPROVAL)) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.OPEN },
      });
      return;
    }

    const hasPending = pos.some((p) => p.status === S.PENDING_SELLER_APPROVAL);
    if (hasPending) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.PARTIALLY_APPROVED },
      });
      return;
    }

    const terminalStatuses: purchase_orders_status[] = [
      S.APPROVED,
      S.PURCHASED,
      S.CANCELED,
    ];
    const terminalMix = pos.every((p) => terminalStatuses.includes(p.status));
    if (!terminalMix) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.PARTIALLY_APPROVED },
      });
      return;
    }

    const hasApproved = pos.some((p) => p.status === S.APPROVED);
    const hasPurchased = pos.some((p) => p.status === S.PURCHASED);

    if (hasApproved && hasPurchased) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.PARTIALLY_APPROVED },
      });
      return;
    }

    if (hasApproved && !hasPurchased) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: PurchaseRequestStatus.READY_TO_PURCHASE },
      });
      return;
    }

    await tx.purchaseRequest.update({
      where: { id: purchaseRequestId },
      data: { status: PurchaseRequestStatus.PARTIALLY_APPROVED },
    });
  }

  private toOrderSummary(
    row: {
      id: bigint;
      purchase_request_id: bigint;
      buyer_organization_id: bigint;
      status: purchase_orders_status;
      items_amount: Prisma.Decimal;
      created_at: Date;
    },
    lineCount: number,
  ) {
    return {
      id: Number(row.id),
      purchaseRequestId: Number(row.purchase_request_id),
      buyerOrganizationId: Number(row.buyer_organization_id),
      status: row.status,
      itemsAmount: this.decStr(row.items_amount),
      lineCount,
      createdAt: row.created_at.toISOString(),
    };
  }

  async findAll(sellerOrganizationId: number, query: SellerOrderListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.purchase_ordersWhereInput = {
      seller_organization_id: BigInt(sellerOrganizationId),
      ...(query.status != null && { status: query.status }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.purchase_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { purchase_order_items: true } },
        },
      }),
      this.prisma.purchase_orders.count({ where }),
    ]);

    return {
      data: rows.map((r) =>
        this.toOrderSummary(r, r._count.purchase_order_items),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(
    sellerOrganizationId: number,
    orderId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const row = await db.purchase_orders.findFirst({
      where: {
        id: BigInt(orderId),
        seller_organization_id: BigInt(sellerOrganizationId),
      },
      include: {
        purchase_order_items: { orderBy: { id: 'asc' } },
        purchase_requests: true,
        organizations_purchase_orders_buyer_organization_idToorganizations: {
          select: { id: true, name: true },
        },
        purchase_order_decisions: { orderBy: { decided_at: 'desc' }, take: 5 },
      },
    });

    if (!row) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '주문을 찾을 수 없습니다.',
      );
    }

    const requestLines = await db.purchase_request_items.findMany({
      where: {
        purchase_request_id: row.purchase_request_id,
        seller_organization_id: BigInt(sellerOrganizationId),
      },
      orderBy: { id: 'asc' },
    });

    const buyer =
      row.organizations_purchase_orders_buyer_organization_idToorganizations;

    return {
      id: Number(row.id),
      purchaseRequestId: Number(row.purchase_request_id),
      purchaseRequestStatus: row.purchase_requests.status,
      buyerOrganizationId: Number(row.buyer_organization_id),
      buyerOrganizationName: buyer.name,
      sellerOrganizationId: Number(row.seller_organization_id),
      status: row.status,
      platform: row.platform,
      externalOrderNo: row.external_order_no,
      orderUrl: row.order_url,
      itemsAmount: this.decStr(row.items_amount),
      shippingFee: this.decStr(row.shipping_fee),
      approvedAt: row.approved_at?.toISOString() ?? null,
      rejectedAt: row.rejected_at?.toISOString() ?? null,
      orderedAt: row.ordered_at?.toISOString() ?? null,
      shippingStatus: row.shipping_status,
      deliveredAt: row.delivered_at?.toISOString() ?? null,
      note: row.note,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      requestLines: requestLines.map((l) => ({
        id: Number(l.id),
        productId: l.product_id != null ? Number(l.product_id) : null,
        productNameSnapshot: l.product_name_snapshot,
        productUrlSnapshot: l.product_url_snapshot,
        unitPriceSnapshot: this.decStr(l.unit_price_snapshot),
        quantity: l.quantity,
        lineTotal: this.decStr(l.line_total),
      })),
      orderLines: row.purchase_order_items.map((l) => ({
        id: Number(l.id),
        purchaseRequestItemId:
          l.purchase_request_item_id != null
            ? Number(l.purchase_request_item_id)
            : null,
        productId: l.product_id != null ? Number(l.product_id) : null,
        productNameSnapshot: l.product_name_snapshot,
        productUrlSnapshot: l.product_url_snapshot,
        unitPriceSnapshot: this.decStr(l.unit_price_snapshot),
        quantity: l.quantity,
        lineTotal: this.decStr(l.line_total),
        createdAt: l.created_at.toISOString(),
      })),
      recentDecisions: row.purchase_order_decisions.map((d) => ({
        decision: d.decision,
        message: d.decision_message,
        decidedAt: d.decided_at.toISOString(),
        decidedByUserId: Number(d.decided_by_user_id),
      })),
    };
  }

  async approve(
    sellerOrganizationId: number,
    orderId: number,
    currentUser: JwtPayload,
    dto: ApproveSellerOrderDto,
  ) {
    this.assertSellerAdmin(currentUser.role);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
        include: {
          purchase_requests: true,
          purchase_order_items: true,
        },
      });

      if (!row) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }

      this.assertPurchaseRequestMutable(row.purchase_requests.status);

      if (row.status !== purchase_orders_status.PENDING_SELLER_APPROVAL) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '승인할 수 있는 상태가 아닙니다.',
        );
      }

      if (row.purchase_order_items.length > 0) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '이미 승인 처리된 주문입니다.',
        );
      }

      const lines = await tx.purchase_request_items.findMany({
        where: {
          purchase_request_id: row.purchase_request_id,
          seller_organization_id: BigInt(sellerOrganizationId),
        },
        orderBy: { id: 'asc' },
      });

      if (lines.length === 0) {
        throw new AppException(
          ErrorCode.BAD_REQUEST,
          '연결된 구매 요청 라인이 없습니다.',
        );
      }

      await tx.purchase_order_items.createMany({
        data: lines.map((pri) => ({
          purchase_order_id: row.id,
          purchase_request_item_id: pri.id,
          product_id: pri.product_id,
          product_name_snapshot: pri.product_name_snapshot,
          product_url_snapshot: pri.product_url_snapshot,
          unit_price_snapshot: pri.unit_price_snapshot,
          quantity: pri.quantity,
          line_total: pri.line_total,
        })),
      });

      const shippingFee =
        dto.shippingFee != null
          ? new Prisma.Decimal(dto.shippingFee)
          : row.shipping_fee;

      await tx.purchase_orders.update({
        where: { id: row.id },
        data: {
          status: purchase_orders_status.APPROVED,
          approved_at: new Date(),
          shipping_fee: shippingFee,
        },
      });

      await tx.purchase_order_decisions.create({
        data: {
          purchase_order_id: row.id,
          decided_by_user_id: BigInt(currentUser.sub),
          decision: purchase_order_decisions_decision.APPROVED,
        },
      });

      await this.rollupPurchaseRequestStatus(tx, row.purchase_request_id);

      return this.findOne(sellerOrganizationId, orderId, tx);
    });
  }

  async reject(
    sellerOrganizationId: number,
    orderId: number,
    currentUser: JwtPayload,
    dto: RejectSellerOrderDto,
  ) {
    this.assertSellerAdmin(currentUser.role);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
        include: { purchase_requests: true },
      });

      if (!row) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }

      this.assertPurchaseRequestMutable(row.purchase_requests.status);

      if (row.status !== purchase_orders_status.PENDING_SELLER_APPROVAL) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '거절할 수 있는 상태가 아닙니다.',
        );
      }

      await tx.purchase_orders.updateMany({
        where: {
          purchase_request_id: row.purchase_request_id,
          id: { not: row.id },
          status: purchase_orders_status.PENDING_SELLER_APPROVAL,
        },
        data: { status: purchase_orders_status.CANCELED },
      });

      await tx.purchase_orders.update({
        where: { id: row.id },
        data: {
          status: purchase_orders_status.REJECTED,
          rejected_at: new Date(),
        },
      });

      await tx.purchase_order_decisions.create({
        data: {
          purchase_order_id: row.id,
          decided_by_user_id: BigInt(currentUser.sub),
          decision: purchase_order_decisions_decision.REJECTED,
          decision_message: dto.message?.trim() || null,
        },
      });

      await this.rollupPurchaseRequestStatus(tx, row.purchase_request_id);

      return this.findOne(sellerOrganizationId, orderId, tx);
    });
  }

  async recordPurchase(
    sellerOrganizationId: number,
    orderId: number,
    currentUser: JwtPayload,
    dto: RecordPurchaseDto,
  ) {
    this.assertSellerAdmin(currentUser.role);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.purchase_orders.findFirst({
          where: {
            id: BigInt(orderId),
            seller_organization_id: BigInt(sellerOrganizationId),
          },
          include: { purchase_requests: true },
        });

        if (!row) {
          throw new AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            '주문을 찾을 수 없습니다.',
          );
        }

        this.assertPurchaseRequestMutable(row.purchase_requests.status);

        if (row.status !== purchase_orders_status.APPROVED) {
          throw new AppException(
            ErrorCode.CONFLICT,
            '실제 구매 처리는 승인된 주문만 가능합니다.',
          );
        }

        await tx.purchase_orders.update({
          where: { id: row.id },
          data: {
            status: purchase_orders_status.PURCHASED,
            platform: dto.platform,
            external_order_no: dto.externalOrderNo?.trim() || null,
            order_url: dto.orderUrl?.trim() || null,
            note: dto.note?.trim() ?? row.note,
            ordered_at: new Date(),
            purchased_by_user_id: BigInt(currentUser.sub),
          },
        });

        await this.rollupPurchaseRequestStatus(tx, row.purchase_request_id);

        return this.findOne(sellerOrganizationId, orderId, tx);
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new AppException(
          ErrorCode.ALREADY_EXISTS,
          '동일 플랫폼·외부 주문번호가 이미 등록되어 있습니다.',
        );
      }
      throw e;
    }
  }

  async updateShipping(
    sellerOrganizationId: number,
    orderId: number,
    currentUser: JwtPayload,
    dto: UpdateShippingDto,
  ) {
    this.assertSellerAdmin(currentUser.role);

    const row = await this.prisma.purchase_orders.findFirst({
      where: {
        id: BigInt(orderId),
        seller_organization_id: BigInt(sellerOrganizationId),
      },
    });

    if (!row) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '주문을 찾을 수 없습니다.',
      );
    }

    if (
      row.status !== purchase_orders_status.APPROVED &&
      row.status !== purchase_orders_status.PURCHASED
    ) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '배송 상태는 승인 또는 구매 완료된 주문만 갱신할 수 있습니다.',
      );
    }

    await this.prisma.purchase_orders.update({
      where: { id: row.id },
      data: {
        shipping_status: dto.shippingStatus.trim(),
        delivered_at: dto.deliveredAt
          ? new Date(dto.deliveredAt)
          : row.delivered_at,
      },
    });

    return this.findOne(sellerOrganizationId, orderId);
  }

  async cancel(
    sellerOrganizationId: number,
    orderId: number,
    currentUser: JwtPayload,
    dto: CancelSellerOrderDto,
  ) {
    this.assertSellerAdmin(currentUser.role);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
        include: { purchase_requests: true },
      });

      if (!row) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }

      if (
        row.status !== purchase_orders_status.PENDING_SELLER_APPROVAL &&
        row.status !== purchase_orders_status.APPROVED
      ) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '취소할 수 있는 상태가 아닙니다.',
        );
      }

      this.assertPurchaseRequestMutable(row.purchase_requests.status);

      const noteParts = [row.note, dto.message?.trim()]
        .filter(Boolean)
        .join('\n---\n');

      await tx.purchase_orders.update({
        where: { id: row.id },
        data: {
          status: purchase_orders_status.CANCELED,
          note: noteParts || row.note,
        },
      });

      await this.rollupPurchaseRequestStatus(tx, row.purchase_request_id);

      return this.findOne(sellerOrganizationId, orderId, tx);
    });
  }
}
