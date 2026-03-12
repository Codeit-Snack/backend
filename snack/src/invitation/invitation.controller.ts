import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { InvitationService } from './invitation.service';
import { InviteDto } from './dto/invite.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteSignUpDto } from './dto/invite-signup.dto';

@ApiTags('invitations')
@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get('info')
  @ApiOperation({
    summary: '초대 정보 조회 (로그인/회원가입 유도용)',
    description:
      '토큰 유효성 검사 및 이메일, 팀명, 회원가입 필요 여부 반환. needsSignUp=true면 회원가입, false면 로그인 유도',
  })
  getInvitationInfo(@Query('token') token: string) {
    return this.invitationService.getInvitationInfo(token);
  }

  @Post('signup')
  @ApiOperation({
    summary: '초대 기반 회원가입',
    description:
      '가입되지 않은 이메일이 초대받은 경우. 회원가입 + 초대 수락 + 로그인까지 한 번에 처리',
  })
  signUpWithInvitation(@Body() dto: InviteSignUpDto) {
    return this.invitationService.signUpWithInvitation(dto);
  }

  @Post('organizations/:organizationId/invite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이메일로 조직 멤버 초대' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: '초대 수락 (이메일 링크 클릭 후 로그인 필요)' })
  async accept(
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.invitationService.accept(dto.token, currentUser);
  }
}
