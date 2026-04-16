import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../common/types/jwt-payload.type';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertOrgAdmin } from '../modules/finance/utils/assert-org-admin.util';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '테스트 메일 발송 (관리자·로그인 필요)' })
  @ApiBody({ type: SendTestMailDto })
  async sendTest(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendTestMailDto,
  ) {
    assertOrgAdmin(user, '테스트 메일은 관리자만 발송할 수 있습니다.');
    await this.mail.sendTestEmail(dto.to);
    return { message: '테스트 메일을 발송했습니다. 수신함을 확인하세요.' };
  }
}
