import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPasswordProperty } from '@/common/swagger/api-password.decorator';

export class InviteSignUpDto {
  @ApiProperty({ description: '초대 링크의 토큰' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPasswordProperty({ minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ description: '표시 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;
}
