import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '@/database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: '서비스 상태 확인' })
  getHealth() {
    return {
      status: 'ok',
      service: 'snack-backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  @ApiHeader({
    name: 'x-health-db-secret',
    required: false,
    description:
      'HEALTH_DB_SECRET이 설정된 환경에서는 이 헤더 값이 일치해야 합니다.',
  })
  @ApiOperation({
    summary: 'DB 연결 상태 확인',
    description:
      '프로덕션에서 `HEALTH_DB_SECRET`이 비어 있으면 이 경로는 노출되지 않습니다. 비밀이 설정된 경우 `x-health-db-secret` 헤더가 필요합니다. 로컬 개발에서 비밀이 없으면 헤더 없이 호출할 수 있습니다.',
  })
  async getDatabaseHealth(@Headers('x-health-db-secret') secret?: string) {
    const expected = this.config.get<string>('HEALTH_DB_SECRET')?.trim();
    const isProd =
      this.config.get<string>('NODE_ENV', 'development') === 'production';

    if (isProd && !expected) {
      throw new NotFoundException();
    }

    if (expected) {
      if (!secret || secret !== expected) {
        throw new UnauthorizedException(
          'Invalid or missing health check secret',
        );
      }
    }

    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
