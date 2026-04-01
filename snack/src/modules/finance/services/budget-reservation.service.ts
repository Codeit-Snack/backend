import { Injectable } from '@nestjs/common';
import {
  budget_reservations_status,
  Prisma,
  purchase_orders_status,
} from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { AuditLogService } from '@/modules/audit/audit-log.service';
import { assertOrgAdmin } from '@/modules/finance/utils/assert-org-admin.util';
import { CreateBudgetReservationDto } from '@/modules/finance/dto/create-budget-reservation.dto';

const PO_BLOCK_RESERVATION: purchase_orders_status[] = [
  purchase_orders_status.REJECTED,
  purchase_orders_status.CANCELED,
];

@Injectable()
export class BudgetReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
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
    assertOrgAdmin(user, '예산 예약 생성은 관리자만 가능합니다.');

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

  async release(
    organizationId: number,
    user: JwtPayload,
    reservationId: number,
  ) {
    assertOrgAdmin(user, '예산 예약 해제는 관리자만 가능합니다.');

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
