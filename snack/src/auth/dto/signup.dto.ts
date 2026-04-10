import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPasswordProperty } from '@/common/swagger/api-password.decorator';

export class SignUpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiPasswordProperty({ minLength: 8, maxLength: 64 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ example: '홍길동' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @ApiProperty({ example: 'Snack Team' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  organizationName: string;

  @ApiProperty({ enum: OrgType, example: OrgType.BUSINESS })
  @IsEnum(OrgType)
  orgType: OrgType;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  businessNumber?: string;

  @ApiPropertyOptional({
    description:
      '`true`이면 가입 직후 세션을 만들고 `login`과 동일한 `accessToken`·`refreshToken`을 함께 반환합니다.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  issueAuthTokens?: boolean;
}
