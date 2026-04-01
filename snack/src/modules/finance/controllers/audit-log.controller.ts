import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';
import { OrganizationId } from '../../catalog/decorators/catalog-context.decorator';
import { FinanceAuditQueryService } from '../services/finance-audit-query.service';
import { AuditLogListQueryDto } from '../dto/audit-log-list-query.dto';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(
    private readonly financeAuditQueryService: FinanceAuditQueryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '감사 로그 조회',
    description: '현재 JWT 조직 기준. 관리자·최고 관리자만',
  })
  list(
    @OrganizationId() organizationId: number,
    @CurrentUser() user: JwtPayload,
    @Query() query: AuditLogListQueryDto,
  ) {
    return this.financeAuditQueryService.list(organizationId, user, query);
  }
}
