import { Injectable } from '@nestjs/common';
import { audit_logs_actor_type, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AuditLogInput = {
  organizationId?: bigint | null;
  actorUserId?: bigint | null;
  actorType?: audit_logs_actor_type;
  action: string;
  targetType?: string | null;
  targetId?: bigint | null;
  message?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    const metadata =
      input.metadata === undefined || input.metadata === null
        ? undefined
        : input.metadata;
    await this.prisma.audit_logs.create({
      data: {
        organization_id: input.organizationId ?? undefined,
        actor_user_id: input.actorUserId ?? undefined,
        actor_type: input.actorType ?? audit_logs_actor_type.USER,
        action: input.action.slice(0, 80),
        target_type: input.targetType?.slice(0, 80) ?? undefined,
        target_id: input.targetId ?? undefined,
        message: input.message ?? undefined,
        metadata,
      },
    });
  }
}
