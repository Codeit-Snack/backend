import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CancelInvitationDto {
  @ApiProperty({ description: '취소할 초대 대상 이메일' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
