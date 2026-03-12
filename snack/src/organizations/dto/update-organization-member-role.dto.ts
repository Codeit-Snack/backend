import { OrgRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrganizationMemberRoleDto {
  @IsEnum(OrgRole)
  role: OrgRole;
}
