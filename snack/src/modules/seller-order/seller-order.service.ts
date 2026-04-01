import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PurchaseRequestStatus,
  purchase_order_decisions_decision,
  purchase_orders_status,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { SellerOrderListQueryDto } from './dto/seller-order-list-query.dto';
import { ApproveSellerOrderDto } from './dto/approve-seller-order.dto';
import { RejectSellerOrderDto } from './dto/reject-seller-order.dto';
import { RecordPurchaseDto } from './dto/record-purchase.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';

@Injectable()
export class SellerOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private computeRollup(
    statuses: purchase_orders_status[],
    current: PurchaseRequestStatus,
  ): PurchaseRequestStatus | null {
    if (
      current === PurchaseRequestStatus.CANCELED ||
      current === PurchaseRequestStatus.PURCHASED
    ) {
      return null;
    }
    if (statuses.length === 0) {
      return null;
    }
    if (
      statuses.some((s) => s === purchase_orders_status.PENDING_SELLER_APPROVAL)
    ) {
      return PurchaseRequestStatus.OPEN;
    }
    if (statuses.every((s) => s === purchase_orders_status.CANCELED)) {
      return PurchaseRequestStatus.CANCELED;
    }
    if (statuses.every((s) => s === purchase_orders_status.REJECTED)) {
      return PurchaseRequestStatus.REJECTED;
    }
    if (statuses.every((s) => s === purchase_orders_status.PURCHASED)) {
      return PurchaseRequestStatus.PURCHASED;
    }
    const onlyApprovedOrPurchased = statuses.every(
      (s) =>
        s === purchase_orders_status.APPROVED ||
        s === purchase_orders_status.PURCHASED,
    );
    if (onlyApprovedOrPurchased) {
      return PurchaseRequestStatus.READY_TO_PURCHASE;
    }
    return PurchaseRequestStatus.PARTIALLY_APPROVED;
  }

  private async syncPurchaseRequestStatus(
    tx: Prisma.TransactionClient,
    purchaseRequestId: bigint,
  ): Promise<void> {
    const pr = await tx.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      select: { status: true },
    });
    if (!pr) {
      return;
    }
    const pos = await tx.purchase_orders.findMany({
      where: { purchase_request_id: purchaseRequestId },
      select: { status: true },
    });
    const next = this.computeRollup(
      pos.map((p) => p.status),
      pr.status,
    );
    if (next != null && next !== pr.status) {
      await tx.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: { status: next },
      });
    }
  }

  async list(
    sellerOrganizationId: number,
    query: SellerOrderListQueryDto,
  ): Promise<{
    data: Array<{
      id: number;
      status: purchase_orders_status;
      purchaseRequestId: number;
      buyerOrganizationId: number;
      itemsAmount: string;
      createdAt: string;
      purchaseRequestStatus: PurchaseRequestStatus;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
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
          purchase_requests: {
            select: { id: true, status: true },
          },
        },
      }),
      this.prisma.purchase_orders.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        purchaseRequestId: Number(r.purchase_request_id),
        buyerOrganizationId: Number(r.buyer_organization_id),
        itemsAmount: this.decStr(r.items_amount),
        createdAt: r.created_at.toISOString(),
        purchaseRequestStatus: r.purchase_requests.status,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(sellerOrganizationId: number, id: number) {
    const row = await this.prisma.purchase_orders.findFirst({
      where: {
        id: BigInt(id),
        seller_organization_id: BigInt(sellerOrganizationId),
      },
      include: {
        purchase_requests: {
          select: {
            id: true,
            status: true,
            requestMessage: true,
            totalAmount: true,
            requestedAt: true,
            buyerOrganizationId: true,
          },
        },
        purchase_order_items: { orderBy: { id: 'asc' } },
        purchase_order_decisions: { orderBy: { decided_at: 'desc' } },
      },
    });
    if (!row) {
      return null;
    }

    const requestLines = await this.prisma.purchase_request_items.findMany({
      where: {
        purchase_request_id: row.purchase_request_id,
        seller_organization_id: BigInt(sellerOrganizationId),
      },
      orderBy: { id: 'asc' },
    });

    return {
      id: Number(row.id),
      status: row.status,
      platform: row.platform,
      externalOrderNo: row.external_order_no,
      orderUrl: row.order_url,
      itemsAmount: this.decStr(row.items_amount),
      shippingFee: this.decStr(row.shipping_fee),
      shippingStatus: row.shipping_status,
      deliveredAt: row.delivered_at?.toISOString() ?? null,
      note: row.note,
      approvedAt: row.approved_at?.toISOString() ?? null,
      rejectedAt: row.rejected_at?.toISOString() ?? null,
      orderedAt: row.ordered_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      purchaseRequest: {
        id: Number(row.purchase_requests.id),
        status: row.purchase_requests.status,
        requestMessage: row.purchase_requests.requestMessage,
        totalAmount: this.decStr(row.purchase_requests.totalAmount),
        requestedAt: row.purchase_requests.requestedAt.toISOString(),
        buyerOrganizationId: Number(row.purchase_requests.buyerOrganizationId),
      },
      requestLineItems: requestLines.map((li) => ({
        id: Number(li.id),
        productId: li.product_id != null ? Number(li.product_id) : null,
        productNameSnapshot: li.product_name_snapshot,
        productUrlSnapshot: li.product_url_snapshot,
        unitPriceSnapshot: this.decStr(li.unit_price_snapshot),
        quantity: li.quantity,
        lineTotal: this.decStr(li.line_total),
      })),
      orderItems: row.purchase_order_items.map((oi) => ({
        id: Number(oi.id),
        purchaseRequestItemId:
          oi.purchase_request_item_id != null
            ? Number(oi.purchase_request_item_id)
            : null,
        productNameSnapshot: oi.product_name_snapshot,
        quantity: oi.quantity,
        lineTotal: this.decStr(oi.line_total),
      })),
      decisions: row.purchase_order_decisions.map((d) => ({
        decision: d.decision,
        message: d.decision_message,
        decidedAt: d.decided_at.toISOString(),
      })),
    };
  }

  async approve(
    sellerOrganizationId: number,
    userId: number,
    orderId: number,
    dto: ApproveSellerOrderDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });
      if (!po) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }
      if (po.status !== purchase_orders_status.PENDING_SELLER_APPROVAL) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '승인할 수 있는 상태가 아닙니다.',
        );
      }

      await tx.purchase_order_decisions.create({
        data: {
          purchase_order_id: po.id,
          decided_by_user_id: BigInt(userId),
          decision: purchase_order_decisions_decision.APPROVED,
          decision_message: dto.decisionMessage ?? null,
        },
      });

      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          status: purchase_orders_status.APPROVED,
          approved_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.syncPurchaseRequestStatus(tx, po.purchase_request_id);
    });

    await this.auditLog.log({
      organizationId: BigInt(sellerOrganizationId),
      actorUserId: BigInt(userId),
      action: 'SELLER_ORDER_APPROVE',
      targetType: 'purchase_order',
      targetId: BigInt(orderId),
      message: null,
      metadata: null,
    });

    return this.findOne(sellerOrganizationId, orderId);
  }

  async reject(
    sellerOrganizationId: number,
    userId: number,
    orderId: number,
    dto: RejectSellerOrderDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });
      if (!po) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }
      if (po.status !== purchase_orders_status.PENDING_SELLER_APPROVAL) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '거절할 수 있는 상태가 아닙니다.',
        );
      }

      await tx.purchase_order_decisions.create({
        data: {
          purchase_order_id: po.id,
          decided_by_user_id: BigInt(userId),
          decision: purchase_order_decisions_decision.REJECTED,
          decision_message: dto.decisionMessage ?? null,
        },
      });

      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          status: purchase_orders_status.REJECTED,
          rejected_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.syncPurchaseRequestStatus(tx, po.purchase_request_id);
    });

    await this.auditLog.log({
      organizationId: BigInt(sellerOrganizationId),
      actorUserId: BigInt(userId),
      action: 'SELLER_ORDER_REJECT',
      targetType: 'purchase_order',
      targetId: BigInt(orderId),
      message: dto.decisionMessage ?? null,
      metadata: null,
    });

    return this.findOne(sellerOrganizationId, orderId);
  }

  async cancel(sellerOrganizationId: number, userId: number, orderId: number) {
    await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });
      if (!po) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }
      if (
        po.status !== purchase_orders_status.PENDING_SELLER_APPROVAL &&
        po.status !== purchase_orders_status.APPROVED
      ) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '취소할 수 있는 상태가 아닙니다.',
        );
      }

      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          status: purchase_orders_status.CANCELED,
          updated_at: new Date(),
        },
      });

      await this.syncPurchaseRequestStatus(tx, po.purchase_request_id);
    });

    await this.auditLog.log({
      organizationId: BigInt(sellerOrganizationId),
      actorUserId: BigInt(userId),
      action: 'SELLER_ORDER_CANCEL',
      targetType: 'purchase_order',
      targetId: BigInt(orderId),
      message: null,
      metadata: null,
    });

    return this.findOne(sellerOrganizationId, orderId);
  }

  async recordPurchase(
    sellerOrganizationId: number,
    userId: number,
    orderId: number,
    dto: RecordPurchaseDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });
      if (!po) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }
      if (po.status !== purchase_orders_status.APPROVED) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '구매 기록은 승인된 주문에만 가능합니다.',
        );
      }

      const lines = await tx.purchase_request_items.findMany({
        where: {
          purchase_request_id: po.purchase_request_id,
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });

      if (lines.length === 0) {
        throw new AppException(
          ErrorCode.BAD_REQUEST,
          '요청 라인이 없어 구매를 기록할 수 없습니다.',
        );
      }

      const existingCount = await tx.purchase_order_items.count({
        where: { purchase_order_id: po.id },
      });
      if (existingCount === 0) {
        await tx.purchase_order_items.createMany({
          data: lines.map((li) => ({
            purchase_order_id: po.id,
            purchase_request_item_id: li.id,
            product_id: li.product_id,
            product_name_snapshot: li.product_name_snapshot,
            product_url_snapshot: li.product_url_snapshot,
            unit_price_snapshot: li.unit_price_snapshot,
            quantity: li.quantity,
            line_total: li.line_total,
          })),
          skipDuplicates: true,
        });
      }

      const shippingFee =
        dto.shippingFee != null && dto.shippingFee !== ''
          ? new Prisma.Decimal(dto.shippingFee)
          : undefined;

      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          status: purchase_orders_status.PURCHASED,
          platform: dto.platform,
          external_order_no: dto.externalOrderNo ?? null,
          order_url: dto.orderUrl ?? null,
          ...(shippingFee !== undefined && { shipping_fee: shippingFee }),
          ordered_at: new Date(),
          purchased_by_user_id: BigInt(userId),
          note: dto.note ?? undefined,
          updated_at: new Date(),
        },
      });

      await this.syncPurchaseRequestStatus(tx, po.purchase_request_id);
    });

    await this.auditLog.log({
      organizationId: BigInt(sellerOrganizationId),
      actorUserId: BigInt(userId),
      action: 'SELLER_ORDER_RECORD_PURCHASE',
      targetType: 'purchase_order',
      targetId: BigInt(orderId),
      message: null,
      metadata: { platform: dto.platform },
    });

    return this.findOne(sellerOrganizationId, orderId);
  }

  async updateShipping(
    sellerOrganizationId: number,
    userId: number,
    orderId: number,
    dto: UpdateShippingDto,
  ) {
    if (dto.shippingStatus == null && dto.deliveredAt == null) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        'shippingStatus 또는 deliveredAt 중 하나는 필요합니다.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchase_orders.findFirst({
        where: {
          id: BigInt(orderId),
          seller_organization_id: BigInt(sellerOrganizationId),
        },
      });
      if (!po) {
        throw new AppException(
          ErrorCode.RESOURCE_NOT_FOUND,
          '주문을 찾을 수 없습니다.',
        );
      }
      if (po.status !== purchase_orders_status.PURCHASED) {
        throw new AppException(
          ErrorCode.CONFLICT,
          '배송 정보는 구매 완료된 주문만 수정할 수 있습니다.',
        );
      }

      await tx.purchase_orders.update({
        where: { id: po.id },
        data: {
          ...(dto.shippingStatus != null && {
            shipping_status: dto.shippingStatus,
          }),
          ...(dto.deliveredAt != null && {
            delivered_at: new Date(dto.deliveredAt),
          }),
          updated_at: new Date(),
        },
      });
    });

    await this.auditLog.log({
      organizationId: BigInt(sellerOrganizationId),
      actorUserId: BigInt(userId),
      action: 'SELLER_ORDER_SHIPPING_UPDATE',
      targetType: 'purchase_order',
      targetId: BigInt(orderId),
      message: null,
      metadata: {
        shippingStatus: dto.shippingStatus ?? null,
        deliveredAt: dto.deliveredAt ?? null,
      },
    });

    return this.findOne(sellerOrganizationId, orderId);
  }
}
