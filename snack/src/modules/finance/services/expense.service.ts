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
import { CreateExpenseDto } from '@/modules/finance/dto/create-expense.dto';
import { ExpenseListQueryDto } from '@/modules/finance/dto/expense-list-query.dto';
import { ExpenseListSort } from '@/modules/finance/dto/expense-list-sort.enum';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private decStr(v: Prisma.Decimal): string {
    return typeof v === 'string' ? v : String(v);
  }

  async create(
    organizationId: number,
    user: JwtPayload,
    dto: CreateExpenseDto,
  ) {
    assertOrgAdmin(user, '지출 기록은 관리자만 가능합니다.');

    const orgId = BigInt(organizationId);
    const po = await this.prisma.purchase_orders.findFirst({
      where: {
        id: BigInt(dto.purchaseOrderId),
        buyer_organization_id: orgId,
      },
    });

    if (!po) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        '판매자 주문을 찾을 수 없습니다.',
      );
    }

    if (po.status !== purchase_orders_status.PURCHASED) {
      throw new AppException(
        ErrorCode.CONFLICT,
        '구매 완료(PURCHASED)된 판매자 주문에만 지출을 등록할 수 있습니다.',
      );
    }

    const dup = await this.prisma.expenses.findUnique({
      where: { purchase_order_id: po.id },
    });
    if (dup) {
      throw new AppException(
        ErrorCode.ALREADY_EXISTS,
        '이 주문에 대한 지출이 이미 등록되어 있습니다.',
      );
    }

    const items = new Prisma.Decimal(dto.itemsAmount);
    const ship = new Prisma.Decimal(dto.shippingAmount ?? 0);
    const amount = items.add(ship);

    const row = await this.prisma.$transaction(async (tx) => {
      const exp = await tx.expenses.create({
        data: {
          buyer_organization_id: orgId,
          purchase_order_id: po.id,
          purchase_request_id: po.purchase_request_id,
          items_amount: items,
          shipping_amount: ship,
          amount,
          note: dto.note?.trim() ?? null,
          recorded_by_user_id: BigInt(user.sub),
        },
      });

      const res = await tx.budget_reservations.findUnique({
        where: { purchase_order_id: po.id },
      });
      if (res && res.status === budget_reservations_status.ACTIVE) {
        await tx.budget_reservations.update({
          where: { id: res.id },
          data: {
            status: budget_reservations_status.CONSUMED,
            consumed_at: new Date(),
          },
        });
      }

      return exp;
    });

    await this.auditLog.log({
      organizationId: orgId,
      actorUserId: BigInt(user.sub),
      action: 'EXPENSE_CREATE',
      targetType: 'expense',
      targetId: row.id,
      metadata: {
        purchaseOrderId: dto.purchaseOrderId,
        amount: this.decStr(amount),
      },
    });

    return {
      id: Number(row.id),
      purchaseOrderId: Number(row.purchase_order_id),
      purchaseRequestId: Number(row.purchase_request_id),
      itemsAmount: this.decStr(row.items_amount),
      shippingAmount: this.decStr(row.shipping_amount),
      amount: this.decStr(row.amount),
      expensedAt: row.expensed_at.toISOString(),
      note: row.note,
    };
  }

  async list(organizationId: number, query: ExpenseListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.expensesWhereInput = {
      buyer_organization_id: BigInt(organizationId),
    };
    if (query.from || query.to) {
      where.expensed_at = {};
      if (query.from) {
        where.expensed_at.gte = new Date(query.from);
      }
      if (query.to) {
        where.expensed_at.lte = new Date(query.to);
      }
    }

    const sort = query.sort ?? ExpenseListSort.ExpensedAtDesc;
    let orderBy: Prisma.expensesOrderByWithRelationInput[];
    switch (sort) {
      case ExpenseListSort.AmountAsc:
        orderBy = [{ amount: 'asc' }, { id: 'asc' }];
        break;
      case ExpenseListSort.AmountDesc:
        orderBy = [{ amount: 'desc' }, { id: 'desc' }];
        break;
      case ExpenseListSort.ExpensedAtDesc:
      default:
        orderBy = [{ expensed_at: 'desc' }, { id: 'desc' }];
        break;
    }

    const [rows, total] = await Promise.all([
      this.prisma.expenses.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          purchase_requests: {
            select: {
              requestedAt: true,
              users: {
                select: {
                  email: true,
                  profile: { select: { displayName: true } },
                },
              },
              purchase_request_items: {
                select: { product_name_snapshot: true },
                orderBy: { id: 'asc' },
                take: 5,
              },
            },
          },
          purchase_orders: {
            select: {
              approved_at: true,
              ordered_at: true,
            },
          },
          users: {
            select: {
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.expenses.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: Number(row.id),
        purchaseOrderId: Number(row.purchase_order_id),
        purchaseRequestId: Number(row.purchase_request_id),
        itemsAmount: this.decStr(row.items_amount),
        shippingAmount: this.decStr(row.shipping_amount),
        amount: this.decStr(row.amount),
        expensedAt: row.expensed_at.toISOString(),
        note: row.note,
        purchaseRequestRequestedAt:
          row.purchase_requests.requestedAt.toISOString(),
        requesterEmail: row.purchase_requests.users.email,
        requesterDisplayName:
          row.purchase_requests.users.profile?.displayName ?? null,
        productNamesPreview: row.purchase_requests.purchase_request_items.map(
          (i) => i.product_name_snapshot,
        ),
        purchaseOrderApprovedAt:
          row.purchase_orders.approved_at?.toISOString() ?? null,
        purchaseOrderOrderedAt:
          row.purchase_orders.ordered_at?.toISOString() ?? null,
        recordedByEmail: row.users?.email ?? null,
        recordedByDisplayName: row.users?.profile?.displayName ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
