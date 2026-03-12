import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendTestMailDto {
  @ApiProperty({ example: 'user@example.com', description: '수신 이메일 주소' })
  @IsEmail()
  @IsNotEmpty()
  to: string;
}
