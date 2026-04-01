import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { OrganizationsService } from '@/organizations/organizations.service';
import { CreateOrganizationDto } from '@/organizations/dto/create-organization.dto';
import { UpdateOrganizationDto } from '@/organizations/dto/update-organization.dto';
import { UpdateOrganizationMemberRoleDto } from '@/organizations/dto/update-organization-member-role.dto';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: '조직 생성' })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(currentUser, dto);
  }

  @Get('me')
  @ApiOperation({ summary: '현재 조직 조회' })
  getMyOrganization(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.organizationsService.getMyOrganization(currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: '조직 수정' })
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(currentUser, organizationId, dto);
  }

  @Get('members')
  @ApiOperation({ summary: '현재 조직 멤버 목록 조회' })
  getMembers(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.organizationsService.getMembers(currentUser);
  }

  @Patch('members/:memberId/role')
  @ApiOperation({ summary: '조직 멤버 권한 변경' })
  updateMemberRole(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateOrganizationMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(
      currentUser,
      BigInt(memberId),
      dto,
    );
  }

  @Patch('members/:memberId/deactivate')
  @ApiOperation({ summary: '조직 멤버 비활성화' })
  deactivateMember(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('memberId') memberId: string,
  ) {
    return this.organizationsService.deactivateMember(
      currentUser,
      BigInt(memberId),
    );
  }
}
