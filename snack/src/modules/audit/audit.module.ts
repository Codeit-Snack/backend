import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { AuditLogService } from '@/modules/audit/audit-log.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
