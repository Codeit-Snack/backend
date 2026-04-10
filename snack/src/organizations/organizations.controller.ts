import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { OrganizationsService } from '@/organizations/organizations.service';
import { CreateOrganizationDto } from '@/organizations/dto/create-organization.dto';
import { UpdateOrganizationDto } from '@/organizations/dto/update-organization.dto';
import { UpdateOrganizationMemberRoleDto } from '@/organizations/dto/update-organization-member-role.dto';
import { OrganizationMembersQueryDto } from '@/organizations/dto/organization-members-query.dto';

@ApiTags('Organizations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({
    summary: '조직 생성',
    description:
      '현재 사용자를 해당 조직의 SUPER_ADMIN 멤버로 추가합니다. `businessNumber`는 선택입니다(조직 유형 필드 없음).',
  })
  @ApiResponse({
    status: 201,
    description:
      '`{ success: true, data: { organization: { id, name, businessNumber? }, membership } }`',
  })
  create(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(currentUser, dto);
  }

  @Get('me')
  @ApiOperation({
    summary: '현재 조직 조회',
    description: 'JWT의 `organizationId`에 해당하는 조직(이름·선택적 사업자번호).',
  })
  getMyOrganization(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.organizationsService.getMyOrganization(currentUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '조직 수정',
    description:
      'SUPER_ADMIN만. 이름·`businessNumber` 변경. 조직 타입(`OrgType`) 필드는 없습니다.',
  })
  update(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(currentUser, organizationId, dto);
  }

  @Get('members')
  @ApiOperation({
    summary: '현재 조직 멤버 목록 조회',
    description:
      '`q`: 표시 이름 또는 이메일 검색. `page`·`limit` 페이지네이션(기본 1페이지, 20건).',
  })
  getMembers(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Query() query: OrganizationMembersQueryDto,
  ) {
    return this.organizationsService.getMembers(currentUser, query);
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
