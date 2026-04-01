import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import type { JwtPayload } from '@/common/types/jwt-payload.type';
import { assertOrgAdmin } from '@/modules/finance/utils/assert-org-admin.util';
import { AuditLogListQueryDto } from '@/modules/finance/dto/audit-log-list-query.dto';

@Injectable()
export class FinanceAuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: number,
    user: JwtPayload,
    query: AuditLogListQueryDto,
  ) {
    assertOrgAdmin(user, '감사 로그 조회는 관리자만 가능합니다.');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.audit_logsWhereInput = {
      organization_id: BigInt(organizationId),
    };
    if (query.action?.trim()) {
      where.action = { startsWith: query.action.trim() };
    }
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) {
        where.created_at.gte = new Date(query.from);
      }
      if (query.to) {
        where.created_at.lte = new Date(query.to);
      }
    }

    const [rows, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: Number(row.id),
        actorType: row.actor_type,
        actorUserId:
          row.actor_user_id != null ? Number(row.actor_user_id) : null,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id != null ? Number(row.target_id) : null,
        message: row.message,
        metadata: row.metadata,
        createdAt: row.created_at.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
