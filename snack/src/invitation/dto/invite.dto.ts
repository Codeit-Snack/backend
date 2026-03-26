import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OrgRole } from '@prisma/client';

export class InviteDto {
  @ApiProperty({ example: 'invitee@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '홍길동', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inviteeName?: string;

  @ApiProperty({ enum: OrgRole, required: false })
  @IsOptional()
  @IsEnum(OrgRole)
  roleToGrant?: OrgRole;
}
