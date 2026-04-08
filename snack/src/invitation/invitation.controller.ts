import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { InvitationService } from '@/invitation/invitation.service';
import { InviteDto } from '@/invitation/dto/invite.dto';
import { AcceptInvitationDto } from '@/invitation/dto/accept-invitation.dto';
import { InviteSignUpDto } from '@/invitation/dto/invite-signup.dto';
import { DeclineInvitationDto } from '@/invitation/dto/decline-invitation.dto';
import { CancelInvitationDto } from '@/invitation/dto/cancel-invitation.dto';
import { ResendInvitationDto } from '@/invitation/dto/resend-invitation.dto';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get('info')
  @ApiOperation({
    summary: '초대 정보 조회 (로그인/회원가입 유도용)',
    description:
      '토큰 유효성 검사 및 이메일, 팀명, 회원가입 필요 여부 반환. needsSignUp=true면 회원가입, false면 로그인 유도',
  })
  @ApiQuery({ name: 'token', required: true, description: '초대 링크의 토큰' })
  getInvitationInfo(@Query('token') token: string) {
    return this.invitationService.getInvitationInfo(token);
  }

  @Post('signup')
  @ApiOperation({
    summary: '초대 기반 회원가입',
    description:
      '가입되지 않은 이메일이 초대받은 경우. 회원가입 + 초대 수락 + 로그인까지 한 번에 처리',
  })
  @ApiResponse({
    status: 201,
    description:
      '`{ success: true, data: { user, organization, membership, tokens } }`',
  })
  signUpWithInvitation(@Body() dto: InviteSignUpDto) {
    return this.invitationService.signUpWithInvitation(dto);
  }

  @Post('organizations/:organizationId/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '이메일로 조직 멤버 초대',
    description:
      '동일 이메일에 유효한 PENDING 초대가 이미 있으면 409 대신 링크·만료를 갱신해 메일을 다시 보냅니다. ' +
      '연속 호출은 `INVITATION_RESEND_COOLDOWN_MINUTES`(기본 5분) 간격이 필요합니다.',
  })
  @ApiResponse({ status: 429, description: '초대 갱신 쿨다운 중' })
  async invite(
    @Param('organizationId') organizationId: string,
    @Body() dto: InviteDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.invitationService.invite(
      BigInt(organizationId),
      dto,
      currentUser,
    );
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '초대 수락 (이메일 링크 클릭 후 로그인 필요)' })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.invitationService.accept(dto.token, currentUser);
  }

  @Post('decline')
  @ApiOperation({
    summary: '초대 거절',
    description:
      '초대 대상이 수락을 거절. 로그인 불필요, 이메일 링크의 토큰만 필요',
  })
  async decline(@Body() dto: DeclineInvitationDto) {
    return this.invitationService.decline(dto.token);
  }

  @Post('organizations/:organizationId/resend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '초대 이메일 재전송',
    description:
      '대기 중인 초대에 대해 새 링크를 발급해 메일을 다시 보냅니다. 조직 관리자·최고 관리자만 가능',
  })
  async resend(
    @Param('organizationId') organizationId: string,
    @Body() dto: ResendInvitationDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.invitationService.resend(
      BigInt(organizationId),
      dto.email,
      currentUser,
    );
  }

  @Post('organizations/:organizationId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '초대 취소',
    description: '초대자가 보낸 초대를 취소. 조직 관리자만 가능',
  })
  async cancel(
    @Param('organizationId') organizationId: string,
    @Body() dto: CancelInvitationDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.invitationService.cancel(
      BigInt(organizationId),
      dto.email,
      currentUser,
    );
  }
}
