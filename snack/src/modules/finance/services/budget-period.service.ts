import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { AuditLogService } from '@/modules/audit/audit-log.service';
import { assertOrgAdmin } from '@/modules/finance/utils/assert-org-admin.util';
import { UpsertBudgetPeriodDto } from '@/modules/finance/dto/upsert-budget-period.dto';

@Injectable()
export class BudgetPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  private monthRangeUtc(
    year: number,
    month: number,
  ): { start: Date; end: Date } {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async upsert(
    organizationId: number,
    user: JwtPayload,
    dto: UpsertBudgetPeriodDto,
  ) {
    assertOrgAdmin(user, '월별 예산 설정은 관리자만 가능합니다.');

    const orgId = BigInt(organizationId);
    const amount = new Prisma.Decimal(dto.budgetAmount);

    const row = await this.prisma.budget_periods.upsert({
      where: {
        organization_id_year_month: {
          organization_id: orgId,
          year: dto.year,
          month: dto.month,
        },
      },
      create: {
        organization_id: orgId,
        year: dto.year,
        month: dto.month,
        budget_amount: amount,
        created_by_user_id: BigInt(user.sub),
      },
      update: {
        budget_amount: amount,
        created_by_user_id: BigInt(user.sub),
      },
    });

    await this.auditLog.log({
      organizationId: orgId,
      actorUserId: BigInt(user.sub),
      action: 'BUDGET_PERIOD_UPSERT',
      targetType: 'budget_period',
      targetId: row.id,
      metadata: {
        year: dto.year,
        month: dto.month,
        budgetAmount: dto.budgetAmount,
      },
    });

    return {
      id: Number(row.id),
      year: row.year,
      month: row.month,
      budgetAmount: this.decStr(row.budget_amount),
      createdAt: row.created_at.toISOString(),
    };
  }

  async findOne(organizationId: number, year: number, month: number) {
    const row = await this.prisma.budget_periods.findUnique({
      where: {
        organization_id_year_month: {
          organization_id: BigInt(organizationId),
          year,
          month,
        },
      },
    });
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      year: row.year,
      month: row.month,
      budgetAmount: this.decStr(row.budget_amount),
      createdAt: row.created_at.toISOString(),
    };
  }

  async listByYear(organizationId: number, year: number) {
    const rows = await this.prisma.budget_periods.findMany({
      where: {
        organization_id: BigInt(organizationId),
        year,
      },
      orderBy: { month: 'asc' },
    });
    return rows.map((row) => ({
      id: Number(row.id),
      year: row.year,
      month: row.month,
      budgetAmount: this.decStr(row.budget_amount),
      createdAt: row.created_at.toISOString(),
    }));
  }

  async summary(organizationId: number, year: number, month: number) {
    const { start, end } = this.monthRangeUtc(year, month);
    const orgId = BigInt(organizationId);

    const period = await this.findOne(organizationId, year, month);
    const budgetAmountDec = period
      ? new Prisma.Decimal(period.budgetAmount)
      : new Prisma.Decimal(0);

    const spentAgg = await this.prisma.expenses.aggregate({
      where: {
        buyer_organization_id: orgId,
        expensed_at: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const spent = spentAgg._sum.amount ?? new Prisma.Decimal(0);

    const activeReservations = await this.prisma.budget_reservations.findMany({
      where: {
        buyer_organization_id: orgId,
        status: 'ACTIVE',
      },
      select: {
        purchase_order_id: true,
        reserved_amount: true,
      },
    });
    const poIds = activeReservations.map((r) => r.purchase_order_id);
    const withExpense =
      poIds.length === 0
        ? []
        : await this.prisma.expenses.findMany({
            where: { purchase_order_id: { in: poIds } },
            select: { purchase_order_id: true },
          });
    const expensedPo = new Set(
      withExpense.map((e) => e.purchase_order_id.toString()),
    );

    let reservedActive = new Prisma.Decimal(0);
    for (const r of activeReservations) {
      if (!expensedPo.has(r.purchase_order_id.toString())) {
        reservedActive = reservedActive.add(r.reserved_amount);
      }
    }

    const remaining = budgetAmountDec.sub(spent).sub(reservedActive);
    return {
      year,
      month,
      budgetAmount: this.decStr(budgetAmountDec),
      spentAmount: this.decStr(spent),
      reservedActiveAmount: this.decStr(reservedActive),
      remainingAmount: this.decStr(
        remaining.lt(0) ? new Prisma.Decimal(0) : remaining,
      ),
      hasPeriodConfigured: period != null,
    };
  }
}
