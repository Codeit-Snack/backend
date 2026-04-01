import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /** DB 연결 가능 여부를 확인합니다 (가벼운 ping). */
  async pingDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
