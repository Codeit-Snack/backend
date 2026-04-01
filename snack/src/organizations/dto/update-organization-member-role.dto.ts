import { ApiProperty } from '@nestjs/swagger';
import { OrgRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({ enum: OrgRole, description: '변경할 역할' })
  @IsEnum(OrgRole)
  role: OrgRole;
}
