import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from '@/organizations/dto/create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
