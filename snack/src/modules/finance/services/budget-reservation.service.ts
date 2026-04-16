import { Injectable } from '@nestjs/common';
import {
  budget_reservations_status,
  Prisma,
  purchase_orders_status,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertSuperAdmin } from '../utils/assert-super-admin.util';
import { CreateBudgetReservationDto } from '../dto/create-budget-reservation.dto';
import { BudgetPeriodService } from './budget-period.service';

const PO_BLOCK_RESERVATION: purchase_orders_status[] = [
  purchase_orders_status.REJECTED,
  purchase_orders_status.CANCELED,
];

@Injectable()
export class BudgetReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly budgetPeriod: BudgetPeriodService,
  ) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private toDto(row: {
    id: bigint;
    purchase_order_id: bigint;
    reserved_amount: Prisma.Decimal;
    status: budget_reservations_status;
    created_at: Date;
    released_at: Date | null;
    consumed_at: Date | null;
  }) {
    return {
      id: Number(row.id),
      purchaseOrderId: Number(row.purchase_order_id),
      reservedAmount: this.decStr(row.reserved_amount),
      status: row.status,
      createdAt: row.created_at.toISOString(),
      releasedAt: row.released_at?.toISOString() ?? null,
      consumedAt: row.consumed_at?.toISOString() ?? null,
    };
  }

  async create(
    organizationId: number,
    user: JwtPayload,
    dto: CreateBudgetReservationDto,
  ) {
    assertSuperAdmin(user, '예산 예약 생성은 최고 관리자만 가능합니다.');

    const po = await this.prisma.purchase_orders.findFirst({
      where: {
        id: BigInt(dto.purchaseOrderId),
        buyer_organization_id: BigInt(organizationId),
      },
    });

    if (!po) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '판매자 주문을 찾을 수 없습니다.',
      );
    }

    if (PO_BLOCK_RESERVATION.includes(po.status)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '거절·취소된 주문에는 예산 예약을 할 수 없습니다.',
      );
    }

    const existingExp = await this.prisma.expenses.findUnique({
      where: { purchase_order_id: po.id },
    });
    if (existingExp) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '이미 지출이 기록된 주문입니다.',
      );
    }

    const existingRes = await this.prisma.budget_reservations.findUnique({
      where: { purchase_order_id: po.id },
    });
    if (existingRes) {
      throw new AppException(
        ErrorCode.ALREADY_EXISTS,
        '이 주문에 대한 예산 예약이 이미 있습니다.',
      );
    }

    const defaultAmt = po.items_amount.add(po.shipping_fee);
    const reserved =
      dto.reservedAmount != null
        ? new Prisma.Decimal(dto.reservedAmount)
        : defaultAmt;

    if (reserved.lte(0)) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        '예약 금액은 0보다 커야 합니다.',
      );
    }

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const funds = await this.budgetPeriod.computeRemainingFunds(
      organizationId,
      y,
      m,
    );
    if (funds.remaining.lt(reserved)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '월별 가용 예산을 초과하는 예약 금액입니다.',
      );
    }

    const row = await this.prisma.budget_reservations.create({
      data: {
        buyer_organization_id: BigInt(organizationId),
        purchase_order_id: po.id,
        reserved_amount: reserved,
        status: budget_reservations_status.ACTIVE,
        created_by_user_id: BigInt(user.sub),
      },
    });

    await this.auditLog.log({
      organizationId: BigInt(organizationId),
      actorUserId: BigInt(user.sub),
      action: 'BUDGET_RESERVATION_CREATE',
      targetType: 'budget_reservation',
      targetId: row.id,
      metadata: {
        purchaseOrderId: dto.purchaseOrderId,
        reservedAmount: this.decStr(reserved),
      },
    });

    return this.toDto(row);
  }

  /**
   * 판매자가 PO를 승인한 직후 같은 DB 트랜잭션에서 호출합니다.
   * 수동 `create`와 동일하게 `items_amount + shipping_fee`를 예약하고, 가용 예산을 검증합니다.
   * 이미 예약이 있으면 새로 만들지 않고 `null`을 반환합니다. 지출이 이미 있으면 예외입니다.
   */
  async ensureReservationForApprovedPurchaseOrder(
    tx: Prisma.TransactionClient,
    params: {
      buyerOrganizationId: number;
      purchaseOrderId: bigint;
      createdByUserId: bigint;
    },
  ): Promise<{
    reservationId: bigint;
    buyerOrganizationId: bigint;
    purchaseOrderId: bigint;
    reservedAmount: Prisma.Decimal;
  } | null> {
    const { buyerOrganizationId, purchaseOrderId, createdByUserId } = params;
    const orgId = BigInt(buyerOrganizationId);

    const po = await tx.purchase_orders.findFirst({
      where: {
        id: purchaseOrderId,
        buyer_organization_id: orgId,
      },
    });

    if (!po) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '판매자 주문을 찾을 수 없습니다.',
      );
    }

    if (po.status !== purchase_orders_status.APPROVED) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '승인된 판매자 주문에만 예산 예약을 연동할 수 있습니다.',
      );
    }

    const existingExp = await tx.expenses.findUnique({
      where: { purchase_order_id: po.id },
    });
    if (existingExp) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '이미 지출이 기록된 주문입니다.',
      );
    }

    const existingRes = await tx.budget_reservations.findUnique({
      where: { purchase_order_id: po.id },
    });
    if (existingRes) {
      return null;
    }

    const reserved = po.items_amount.add(po.shipping_fee);
    if (reserved.lte(0)) {
      throw new AppException(
        ErrorCode.BAD_REQUEST,
        '예약 금액은 0보다 커야 합니다.',
      );
    }

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const funds = await this.budgetPeriod.computeRemainingFunds(
      buyerOrganizationId,
      y,
      m,
    );
    if (funds.remaining.lt(reserved)) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '월별 가용 예산을 초과하여 승인할 수 없습니다.',
      );
    }

    const row = await tx.budget_reservations.create({
      data: {
        buyer_organization_id: orgId,
        purchase_order_id: po.id,
        reserved_amount: reserved,
        status: budget_reservations_status.ACTIVE,
        created_by_user_id: createdByUserId,
      },
    });

    return {
      reservationId: row.id,
      buyerOrganizationId: orgId,
      purchaseOrderId: po.id,
      reservedAmount: reserved,
    };
  }

  async release(
    organizationId: number,
    user: JwtPayload,
    reservationId: number,
  ) {
    assertSuperAdmin(user, '예산 예약 해제는 최고 관리자만 가능합니다.');

    const row = await this.prisma.budget_reservations.findFirst({
      where: {
        id: BigInt(reservationId),
        buyer_organization_id: BigInt(organizationId),
      },
    });

    if (!row) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '예산 예약을 찾을 수 없습니다.',
      );
    }

    if (row.status !== budget_reservations_status.ACTIVE) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '활성 예약만 해제할 수 있습니다.',
      );
    }

    const updated = await this.prisma.budget_reservations.update({
      where: { id: row.id },
      data: {
        status: budget_reservations_status.RELEASED,
        released_at: new Date(),
      },
    });

    await this.auditLog.log({
      organizationId: BigInt(organizationId),
      actorUserId: BigInt(user.sub),
      action: 'BUDGET_RESERVATION_RELEASE',
      targetType: 'budget_reservation',
      targetId: row.id,
    });

    return this.toDto(updated);
  }

  async list(organizationId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { buyer_organization_id: BigInt(organizationId) };
    const [rows, total] = await Promise.all([
      this.prisma.budget_reservations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.budget_reservations.count({ where }),
    ]);
    return {
      data: rows.map((r) => this.toDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
