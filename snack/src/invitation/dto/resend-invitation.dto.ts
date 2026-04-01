import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendInvitationDto {
  @ApiProperty({ description: '재전송할 초대 대상 이메일' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
