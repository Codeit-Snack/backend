import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '@/auth/auth.service';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { LoginDto } from '@/auth/dto/login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { SignUpDto } from '@/auth/dto/signup.dto';
import { ChangePasswordDto } from '@/auth/dto/change-password.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
    description:
      '`issueAuthTokens: true`이면 응답 `data.tokens`에 access·refresh 토큰 포함(로그인과 동일 세션 규칙).',
  })
  @ApiResponse({
    status: 201,
    description:
      '`{ success: true, data: { user, organization, membership, tokens? } }`',
  })
  signUp(@Body() dto: SignUpDto) {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @ApiOperation({
    summary: '로그인',
    description:
      '응답 `data.tokens`에 accessToken·refreshToken. 이후 API는 Bearer accessToken 사용.',
  })
  @ApiResponse({
    status: 201,
    description:
      '`{ success: true, data: { user, organization, membership, tokens } }`',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: '토큰 재발급' })
  @ApiResponse({
    status: 200,
    description: '`{ success: true, data: { message, tokens } }`',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: '비밀번호 재설정 메일 요청',
    description:
      '등록 여부와 관계없이 동일한 메시지를 반환합니다. 메일 링크의 `token`으로 `reset-password` 호출.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: '항상 동일한 안내 문구 (이메일 열거 방지)',
    schema: {
      example: {
        success: true,
        data: {
          message:
            '요청하신 이메일이 등록되어 있으면 비밀번호 재설정 안내를 보냈습니다.',
        },
      },
    },
  })
  @ApiResponse({ status: 500, description: 'SMTP 실패 등' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.requestPasswordReset(dto, {
      ip: req.ip,
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
    });
  }

  @Post('reset-password')
  @ApiOperation({
    summary: '토큰으로 비밀번호 재설정',
    description: '성공 시 기존 세션 전부 무효화. 다시 로그인 필요.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { message: '비밀번호가 재설정되었습니다. 다시 로그인해 주세요.' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '만료·사용됨·유효하지 않은 토큰' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '로그아웃 (현재 세션 revoke)' })
  @ApiResponse({
    status: 200,
    description: '`{ success: true, data: { message } }`',
  })
  logout(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.logout(currentUser);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: '내 정보 조회' })
  @ApiResponse({
    status: 200,
    description:
      '`{ success: true, data: { user, organization, membership } }`',
  })
  getMe(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.getMe(currentUser);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '비밀번호 변경',
    description: '성공 시 다른 기기 세션 포함 활성 세션 전부 revoke',
  })
  @ApiResponse({
    status: 200,
    description: '`{ success: true, data: { message } }`',
  })
  changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(BigInt(user.sub), dto);
  }
}
