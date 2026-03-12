import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrgType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Snack Team' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: OrgType, example: OrgType.BUSINESS })
  @IsEnum(OrgType)
  orgType: OrgType;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  businessNumber?: string;
}
