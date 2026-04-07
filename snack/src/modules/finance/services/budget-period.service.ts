import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { AuditLogService } from '@/modules/audit/audit-log.service';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
import { assertOrgAdmin } from '@/modules/finance/utils/assert-org-admin.util';
import { UpsertBudgetPeriodDto } from '@/modules/finance/dto/upsert-budget-period.dto';
import { UpdateMonthlyBudgetDefaultDto } from '@/modules/finance/dto/update-monthly-budget-default.dto';

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

  /**
   * 해당 연·월에 budget_periods 행이 없으면 organizations.default_monthly_budget 으로 1행 생성(B).
   * 월별 조회·요약·잔액 계산·예약 가능액 산출 시 호출됩니다.
   */
  private async ensurePeriodFromOrgDefault(
    organizationId: number,
    year: number,
    month: number,
  ) {
    const orgId = BigInt(organizationId);
    const whereUnique = {
      organization_id_year_month: {
        organization_id: orgId,
        year,
        month,
      },
    };

    const existing = await this.prisma.budget_periods.findUnique({
      where: whereUnique,
    });
    if (existing) {
      return existing;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, defaultMonthlyBudget: true },
    });
    if (!org) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, '조직을 찾을 수 없습니다.');
    }

    const amount = new Prisma.Decimal(org.defaultMonthlyBudget);

    try {
      return await this.prisma.budget_periods.create({
        data: {
          organization_id: orgId,
          year,
          month,
          budget_amount: amount,
          created_by_user_id: null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const row = await this.prisma.budget_periods.findUnique({
          where: whereUnique,
        });
        if (row) {
          return row;
        }
      }
      throw error;
    }
  }

  async getMonthlyBudgetDefault(organizationId: number, user: JwtPayload) {
    assertOrgAdmin(
      user,
      '매달 시작 예산 기본값 조회는 관리자만 가능합니다.',
    );
    const org = await this.prisma.organization.findUnique({
      where: { id: BigInt(organizationId) },
      select: { defaultMonthlyBudget: true },
    });
    if (!org) {
      throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, '조직을 찾을 수 없습니다.');
    }
    return {
      defaultMonthlyBudget: this.decStr(org.defaultMonthlyBudget),
    };
  }

  async updateMonthlyBudgetDefault(
    organizationId: number,
    user: JwtPayload,
    dto: UpdateMonthlyBudgetDefaultDto,
  ) {
    assertOrgAdmin(
      user,
      '매달 시작 예산 기본값 수정은 관리자만 가능합니다.',
    );
    const orgId = BigInt(organizationId);
    const amount = new Prisma.Decimal(dto.defaultMonthlyBudget);

    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { defaultMonthlyBudget: amount },
      select: { id: true, defaultMonthlyBudget: true },
    });

    await this.auditLog.log({
      organizationId: orgId,
      actorUserId: BigInt(user.sub),
      action: 'ORG_DEFAULT_MONTHLY_BUDGET_UPDATE',
      targetType: 'organization',
      targetId: org.id,
      metadata: { defaultMonthlyBudget: dto.defaultMonthlyBudget },
    });

    return {
      defaultMonthlyBudget: this.decStr(org.defaultMonthlyBudget),
    };
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
      hasPeriodConfigured: true,
    };
  }

  async findOne(organizationId: number, year: number, month: number) {
    const row = await this.ensurePeriodFromOrgDefault(
      organizationId,
      year,
      month,
    );
    return {
      id: Number(row.id),
      year: row.year,
      month: row.month,
      budgetAmount: this.decStr(row.budget_amount),
      createdAt: row.created_at.toISOString(),
      hasPeriodConfigured: row.created_by_user_id != null,
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
      hasPeriodConfigured: row.created_by_user_id != null,
    }));
  }

  /**
   * 해당 월의 예산·지출·ACTIVE 예약을 반영한 가용 잔액.
   * 행이 없으면 조직 기본값으로 행을 만든 뒤 계산합니다.
   * `explicitlyConfigured`: 관리자가 `POST /budget/periods`로 확정한 적 있음(`created_by_user_id` 존재).
   */
  async computeRemainingFunds(
    organizationId: number,
    year: number,
    month: number,
  ): Promise<{
    explicitlyConfigured: boolean;
    remaining: Prisma.Decimal;
    budgetAmount: Prisma.Decimal;
    spent: Prisma.Decimal;
    reservedActive: Prisma.Decimal;
  }> {
    const { start, end } = this.monthRangeUtc(year, month);
    const orgId = BigInt(organizationId);

    const periodRow = await this.ensurePeriodFromOrgDefault(
      organizationId,
      year,
      month,
    );
    const budgetAmountDec = new Prisma.Decimal(periodRow.budget_amount);

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
      explicitlyConfigured: periodRow.created_by_user_id != null,
      remaining,
      budgetAmount: budgetAmountDec,
      spent,
      reservedActive,
    };
  }

  async summary(organizationId: number, year: number, month: number) {
    const f = await this.computeRemainingFunds(organizationId, year, month);
    const remainingCapped = f.remaining.lt(0)
      ? new Prisma.Decimal(0)
      : f.remaining;
    return {
      year,
      month,
      budgetAmount: this.decStr(f.budgetAmount),
      spentAmount: this.decStr(f.spent),
      reservedActiveAmount: this.decStr(f.reservedActive),
      remainingAmount: this.decStr(remainingCapped),
      hasPeriodConfigured: f.explicitlyConfigured,
    };
  }
}
