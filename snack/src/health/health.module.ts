import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { HealthController } from '@/health/health.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
