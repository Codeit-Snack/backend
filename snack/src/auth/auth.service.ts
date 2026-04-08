import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { OrgRole, OrgType, Prisma, auth_sessions_status } from '@prisma/client';
import { ChangePasswordDto } from '@/auth/dto/change-password.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { hashPassword, verifyPassword } from '@/common/utils/password.util';
import { PrismaService } from '@/database/prisma.service';
import { MailService } from '@/mail/mail.service';
import { AuditLogService } from '@/modules/audit/audit-log.service';
import { InvitationService } from '@/invitation/invitation.service';
import { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { LoginDto } from '@/auth/dto/login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import { SignUpDto } from '@/auth/dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly invitationService: InvitationService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async signUp(dto: SignUpDto) {
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    const organizationName = dto.organizationName.trim();
    const businessNumber = dto.businessNumber?.trim() ?? null;

    const bcryptRounds = Number(
      this.configService.get<string>('BCRYPT_ROUNDS', '12'),
    );

    if (dto.orgType === OrgType.BUSINESS && !businessNumber) {
      throw new BadRequestException(
        'BUSINESS 조직은 businessNumber가 필요합니다.',
      );
    }

    if (dto.orgType === OrgType.PERSONAL && businessNumber) {
      throw new BadRequestException(
        'PERSONAL 조직은 businessNumber를 보낼 수 없습니다.',
      );
    }

    const passwordHash = await hashPassword(dto.password, bcryptRounds);

    try {
      const organization = await this.prisma.organization.create({
        data: {
          name: organizationName,
          orgType: dto.orgType,
          businessNumber:
            dto.orgType === OrgType.BUSINESS ? businessNumber : null,
          members: {
            create: {
              role: OrgRole.SUPER_ADMIN,
              isActive: true,
              user: {
                create: {
                  email,
                  passwordHash,
                  profile: {
                    create: {
                      displayName,
                    },
                  },
                },
              },
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                include: {
                  profile: true,
                },
              },
            },
          },
        },
      });

      const membership = organization.members[0];
      const user = membership.user;

      return {
        message: '회원가입이 완료되었습니다.',
        user: {
          id: user.id.toString(),
          email: user.email,
          displayName: user.profile?.displayName ?? null,
        },
        organization: {
          id: organization.id.toString(),
          name: organization.name,
          orgType: organization.orgType,
          businessNumber: organization.businessNumber,
        },
        membership: {
          id: membership.id.toString(),
          role: membership.role,
        },
      };
    } catch (error) {
      console.error('signup error:', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }

      throw new InternalServerErrorException(
        '회원가입 처리 중 오류가 발생했습니다.',
      );
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        memberships: {
          where: { isActive: true },
          include: {
            organization: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isPasswordValid = await verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const primaryMembership = user.memberships[0];

    if (!primaryMembership) {
      throw new UnauthorizedException('활성 조직 멤버십이 없습니다.');
    }

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const refreshExpiresAt = this.getExpiryDate(refreshExpiresIn);

    // refresh_token_hash 는 UNIQUE — 빈 문자열이면 두 번째 로그인부터 P2002 로 500 발생
    const session = await this.prisma.auth_sessions.create({
      data: {
        user_id: user.id,
        current_organization_id: primaryMembership.organizationId,
        refresh_token_hash: `login_pending_${randomBytes(24).toString('hex')}`,
        expires_at: refreshExpiresAt,
        status: auth_sessions_status.ACTIVE,
      },
    });

    const accessPayload = {
      sub: user.id.toString(),
      email: user.email,
      organizationId: primaryMembership.organizationId.toString(),
      role: primaryMembership.role,
      sessionId: session.id.toString(),
    };

    const refreshPayload = {
      sub: user.id.toString(),
      type: 'refresh' as const,
      sessionId: session.id.toString(),
    };

    const accessToken = await this.signAccessToken(accessPayload);
    const refreshToken = await this.signRefreshToken(refreshPayload);

    const refreshTokenHash = await hashPassword(refreshToken, 10);

    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: {
        refresh_token_hash: refreshTokenHash,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    let invitationAccepted = false;
    if (dto.invitationToken) {
      try {
        const currentUser: CurrentUserPayload = {
          sub: user.id.toString(),
          email: user.email,
          organizationId: primaryMembership.organizationId.toString(),
          role: primaryMembership.role,
          sessionId: session.id.toString(),
        };
        await this.invitationService.accept(dto.invitationToken, currentUser);
        invitationAccepted = true;
      } catch {
        /* 초대 수락 실패 무시 */
      }
    }

    return {
      message: invitationAccepted
        ? '로그인 및 초대 수락이 완료되었습니다.'
        : '로그인이 완료되었습니다.',
      invitationAccepted,
      user: {
        id: user.id.toString(),
        email: user.email,
        displayName: user.profile?.displayName ?? null,
      },
      organization: {
        id: primaryMembership.organization.id.toString(),
        name: primaryMembership.organization.name,
        orgType: primaryMembership.organization.orgType,
      },
      membership: {
        id: primaryMembership.id.toString(),
        role: primaryMembership.role,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const sessionId = BigInt(payload.sessionId);
    const userId = BigInt(payload.sub);

    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        id: sessionId,
        user_id: userId,
        status: auth_sessions_status.ACTIVE,
        expires_at: {
          gt: new Date(),
        },
      },
      include: {
        users: {
          include: {
            profile: true,
            memberships: {
              where: { isActive: true },
              include: {
                organization: true,
              },
              orderBy: {
                id: 'asc',
              },
            },
          },
        },
      },
    });

    if (!session || !session.users || !session.users.isActive) {
      throw new UnauthorizedException('유효한 세션이 아닙니다.');
    }

    const isRefreshTokenValid = await verifyPassword(
      dto.refreshToken,
      session.refresh_token_hash,
    );

    if (!isRefreshTokenValid) {
      await this.prisma.auth_sessions.update({
        where: { id: session.id },
        data: {
          status: auth_sessions_status.REVOKED,
          revoked_at: new Date(),
        },
      });

      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const membership = session.users.memberships.find(
      (item) =>
        item.organizationId.toString() ===
        session.current_organization_id?.toString(),
    );

    if (!membership) {
      throw new UnauthorizedException('활성 조직 멤버십이 없습니다.');
    }

    const newAccessPayload = {
      sub: session.users.id.toString(),
      email: session.users.email,
      organizationId: membership.organizationId.toString(),
      role: membership.role,
      sessionId: session.id.toString(),
    };

    const newRefreshPayload = {
      sub: session.users.id.toString(),
      type: 'refresh' as const,
      sessionId: session.id.toString(),
    };

    const newAccessToken = await this.signAccessToken(newAccessPayload);
    const newRefreshToken = await this.signRefreshToken(newRefreshPayload);

    const newRefreshTokenHash = await hashPassword(newRefreshToken, 10);

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const refreshExpiresAt = this.getExpiryDate(refreshExpiresIn);

    await this.prisma.auth_sessions.update({
      where: { id: session.id },
      data: {
        refresh_token_hash: newRefreshTokenHash,
        expires_at: refreshExpiresAt,
        last_seen_at: new Date(),
      },
    });

    return {
      message: '토큰이 재발급되었습니다.',
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  async logout(currentUser: CurrentUserPayload) {
    if (!currentUser.sessionId) {
      throw new UnauthorizedException('세션 정보가 없습니다.');
    }

    await this.prisma.auth_sessions.updateMany({
      where: {
        id: BigInt(currentUser.sessionId),
        user_id: BigInt(currentUser.sub),
        status: auth_sessions_status.ACTIVE,
      },
      data: {
        status: auth_sessions_status.REVOKED,
        revoked_at: new Date(),
      },
    });

    return {
      message: '로그아웃이 완료되었습니다.',
    };
  }

  async getMe(currentUser: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(currentUser.sub) },
      include: {
        profile: true,
        memberships: {
          where: {
            organizationId: BigInt(currentUser.organizationId),
            isActive: true,
          },
          include: {
            organization: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const membership = user.memberships[0];

    if (!membership) {
      throw new UnauthorizedException('활성 조직 멤버십이 없습니다.');
    }

    return {
      message: '내 정보 조회에 성공했습니다.',
      user: {
        id: user.id.toString(),
        email: user.email,
        displayName: user.profile?.displayName ?? null,
      },
      organization: {
        id: membership.organization.id.toString(),
        name: membership.organization.name,
        orgType: membership.organization.orgType,
      },
      membership: {
        id: membership.id.toString(),
        role: membership.role,
      },
    };
  }

  private async signAccessToken(payload: {
    sub: string;
    email: string;
    organizationId: string;
    role: OrgRole;
    sessionId: string;
  }) {
    const accessSecret =
      this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const accessExpiresIn = this.configService.getOrThrow<string>(
      'JWT_ACCESS_EXPIRES_IN',
    );

    return this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    } as JwtSignOptions);
  }

  private async signRefreshToken(payload: {
    sub: string;
    type: 'refresh';
    sessionId: string;
  }) {
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    return this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    } as JwtSignOptions);
  }

  private async verifyRefreshToken(token: string): Promise<{
    sub: string;
    type: 'refresh';
    sessionId: string;
  }> {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        type: 'refresh';
        sessionId: string;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }
  }

  private getExpiryDate(expiresIn: string): Date {
    const now = new Date();

    if (expiresIn.endsWith('d')) {
      const days = Number(expiresIn.slice(0, -1));
      now.setDate(now.getDate() + days);
      return now;
    }

    if (expiresIn.endsWith('h')) {
      const hours = Number(expiresIn.slice(0, -1));
      now.setHours(now.getHours() + hours);
      return now;
    }

    if (expiresIn.endsWith('m')) {
      const minutes = Number(expiresIn.slice(0, -1));
      now.setMinutes(now.getMinutes() + minutes);
      return now;
    }

    if (expiresIn.endsWith('s')) {
      const seconds = Number(expiresIn.slice(0, -1));
      now.setSeconds(now.getSeconds() + seconds);
      return now;
    }

    now.setDate(now.getDate() + 7);
    return now;
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const isMatched = await verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isMatched) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
    }

    const bcryptRounds = Number(
      this.configService.get<string>('BCRYPT_ROUNDS', '12'),
    );

    const newPasswordHash = await hashPassword(dto.newPassword, bcryptRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    await this.prisma.auth_sessions.updateMany({
      where: {
        user_id: userId,
        status: auth_sessions_status.ACTIVE,
      },
      data: {
        status: auth_sessions_status.REVOKED,
        revoked_at: new Date(),
      },
    });

    return {
      message: '비밀번호가 변경되었습니다.',
    };
  }

  async requestPasswordReset(
    dto: ForgotPasswordDto,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const generic = {
      message:
        '요청하신 이메일이 등록되어 있으면 비밀번호 재설정 안내를 보냈습니다.',
    };

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return generic;
    }

    const expiresIn = this.configService.get<string>(
      'PASSWORD_RESET_EXPIRES_IN',
      '1h',
    );
    const expiresAt = this.getExpiryDate(expiresIn);

    await this.prisma.password_reset_tokens.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const resetRow = await this.prisma.password_reset_tokens.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        requested_ip: meta?.ip?.slice(0, 45) ?? null,
        requested_user_agent: meta?.userAgent ?? null,
      },
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const path =
      this.configService.get<string>(
        'PASSWORD_RESET_PATH',
        '/reset-password',
      ) ?? '/reset-password';
    const resetLink = `${frontendUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}?token=${rawToken}`;

    try {
      await this.mailService.sendPasswordResetEmail({
        to: email,
        resetLink,
      });
    } catch (err) {
      console.error('password reset mail failed:', err);
      await this.prisma.password_reset_tokens.delete({
        where: { id: resetRow.id },
      });
      throw new InternalServerErrorException(
        '비밀번호 재설정 메일 발송에 실패했습니다. SMTP 설정을 확인한 뒤 잠시 후 다시 시도해 주세요.',
      );
    }

    await this.auditLog.log({
      organizationId: null,
      actorUserId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      targetType: 'user',
      targetId: user.id,
      message: null,
      metadata: null,
    });

    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    const row = await this.prisma.password_reset_tokens.findUnique({
      where: { token_hash: tokenHash },
      include: {
        users: { select: { id: true, isActive: true } },
      },
    });

    if (
      !row ||
      row.used_at != null ||
      row.expires_at <= new Date() ||
      !row.users.isActive
    ) {
      throw new BadRequestException(
        '유효하지 않거나 만료된 재설정 링크입니다.',
      );
    }

    const bcryptRounds = Number(
      this.configService.get<string>('BCRYPT_ROUNDS', '12'),
    );
    const passwordHash = await hashPassword(dto.password, bcryptRounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.user_id },
        data: { passwordHash },
      });
      await tx.password_reset_tokens.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      });
      await tx.auth_sessions.updateMany({
        where: {
          user_id: row.user_id,
          status: auth_sessions_status.ACTIVE,
        },
        data: {
          status: auth_sessions_status.REVOKED,
          revoked_at: new Date(),
        },
      });
    });

    await this.auditLog.log({
      organizationId: null,
      actorUserId: row.user_id,
      action: 'PASSWORD_RESET_COMPLETE',
      targetType: 'user',
      targetId: row.user_id,
      message: null,
      metadata: null,
    });

    return { message: '비밀번호가 재설정되었습니다. 다시 로그인해 주세요.' };
  }
}
