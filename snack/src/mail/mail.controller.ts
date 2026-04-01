import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Post('test')
  @ApiOperation({ summary: '테스트 메일 발송 (개발용)' })
  @ApiBody({ type: SendTestMailDto })
  async sendTest(@Body() dto: SendTestMailDto) {
    await this.mail.sendTestEmail(dto.to);
    return { message: '테스트 메일을 발송했습니다. 수신함을 확인하세요.' };
  }
}
