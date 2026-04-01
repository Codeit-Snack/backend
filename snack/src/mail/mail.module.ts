import { Global, Module } from '@nestjs/common';
import { MailController } from '@/mail/mail.controller';
import { MailService } from '@/mail/mail.service';

@Global()
@Module({
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
