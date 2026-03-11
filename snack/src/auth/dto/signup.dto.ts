import { OrgType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  organizationName: string;

  @IsEnum(OrgType)
  orgType: OrgType;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  businessNumber?: string;
}
