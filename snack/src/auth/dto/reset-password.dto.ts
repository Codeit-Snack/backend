import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPasswordProperty } from '@/common/swagger/api-password.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: '이메일 링크에 포함된 토큰' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @ApiPasswordProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
