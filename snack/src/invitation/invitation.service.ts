import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { InvitationStatus, OrgRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { MailService } from '@/mail/mail.service';
import { RedisService } from '@/redis/redis.service';
import { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { AppException } from '@/common/exceptions/app.exception';
import { ErrorCode } from '@/common/enums/error-code.enum';
import { InviteDto } from '@/invitation/dto/invite.dto';

const INVITATION_TOKEN_PREFIX = 'invitation:';
/** 초대 ID → 현재 평문 토큰 (취소·재전송 시 Redis 정리용) */
const INVITATION_META_PREFIX = 'invitation:meta:';

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async invite(
    organizationId: bigint,
    dto: InviteDto,
    currentUser: CurrentUserPayload,
  ) {
    const email = dto.email.trim().toLowerCase();
    const expiresHours = Number(
      this.configService.get<string>('INVITATION_EXPIRES_HOURS', '168'),
    );
    const ttlSeconds = expiresHours * 60 * 60;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { members: true },
    });

    if (!org) {
      throw new AppException(ErrorCode.NOT_FOUND, '조직을 찾을 수 없습니다.');
    }

    this.assertOrgAdminForInvitations(
      org,
      currentUser,
      '초대 권한이 없습니다.',
    );

    const alreadyMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email },
        isActive: true,
      },
    });
    if (alreadyMember) {
      throw new AppException(ErrorCode.ALREADY_EXISTS, '이미 조직 멤버입니다.');
    }

    const pendingInvite = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      return this.refreshPendingInvitationAndSendMail({
        invitation: pendingInvite,
        org,
        organizationId,
        email,
        dto,
        currentUser,
        expiresHours,
        ttlSeconds,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const roleToGrant = dto.roleToGrant ?? OrgRole.MEMBER;

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        inviteeName: dto.inviteeName?.trim(),
        tokenHash,
        status: InvitationStatus.PENDING,
        invitedByUserId: BigInt(currentUser.sub),
        roleToGrant,
        expiresAt,
      },
    });

    await this.persistInvitationToken(
      invitation.id,
      organizationId,
      email,
      roleToGrant,
      token,
      expiresAt,
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

    await this.mail.sendInvitationEmail({
      to: email,
      inviteeName: dto.inviteeName,
      organizationName: org.name,
      inviteLink,
      expiresInHours: expiresHours,
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { lastSentAt: new Date() },
    });

    return {
      message: '초대 이메일을 발송했습니다.',
      email,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async accept(token: string, currentUser: CurrentUserPayload) {
    const redisKey = `${INVITATION_TOKEN_PREFIX}${token}`;
    const redisData = await this.redis.get(redisKey);

    if (!redisData) {
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대 링크가 만료되었거나 유효하지 않습니다.',
      );
    }

    const { invitationId, organizationId, email, roleToGrant } =
      JSON.parse(redisData);

    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(currentUser.sub) },
    });

    if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        '초대된 이메일 계정으로 로그인해 주세요.',
      );
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: BigInt(invitationId) },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대가 만료되었거나 이미 처리되었습니다.',
      );
    }

    if (this.hashToken(token) !== invitation.tokenHash) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_INVALID,
        '유효하지 않은 초대 링크입니다.',
      );
    }

    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: BigInt(organizationId),
        userId: user.id,
        isActive: true,
      },
    });

    if (existingMember) {
      await this.redis.del(redisKey);
      throw new AppException(ErrorCode.ALREADY_EXISTS, '이미 조직 멤버입니다.');
    }

    await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: {
          organizationId: BigInt(organizationId),
          userId: user.id,
          role: roleToGrant as OrgRole,
          isActive: true,
        },
      }),
      this.prisma.invitation.update({
        where: { id: BigInt(invitationId) },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedUserId: user.id,
          acceptedAt: new Date(),
        },
      }),
    ]);

    await this.clearInvitationRedis(BigInt(invitationId));
    await this.redis.del(redisKey);

    return {
      message: '초대를 수락했습니다.',
      organizationId,
    };
  }

  /** 초대 거절 (초대 대상이 수락을 거절) - 토큰만 있으면 됨, 로그인 불필요 */
  async decline(token: string) {
    const redisKey = `${INVITATION_TOKEN_PREFIX}${token}`;
    const redisData = await this.redis.get(redisKey);

    if (!redisData) {
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대 링크가 만료되었거나 유효하지 않습니다.',
      );
    }

    const { invitationId } = JSON.parse(redisData);

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: BigInt(invitationId) },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대가 만료되었거나 이미 처리되었습니다.',
      );
    }

    if (this.hashToken(token) !== invitation.tokenHash) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_INVALID,
        '유효하지 않은 초대 링크입니다.',
      );
    }

    await this.prisma.invitation.update({
      where: { id: BigInt(invitationId) },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    await this.clearInvitationRedis(BigInt(invitationId));
    await this.redis.del(redisKey);

    return {
      message: '초대를 거절했습니다.',
    };
  }

  /** 초대 취소 (초대자가 보낸 초대를 취소) - 조직 관리자만 가능 */
  async cancel(
    organizationId: bigint,
    email: string,
    currentUser: CurrentUserPayload,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { members: true },
    });

    if (!org) {
      throw new AppException(ErrorCode.NOT_FOUND, '조직을 찾을 수 없습니다.');
    }

    this.assertOrgAdminForInvitations(
      org,
      currentUser,
      '초대 취소 권한이 없습니다.',
    );

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        '취소할 대기 중인 초대가 없습니다.',
      );
    }

    await this.clearInvitationRedis(invitation.id);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return {
      message: '초대를 취소했습니다.',
      email: normalizedEmail,
    };
  }

  /** 대기 중인 초대에 새 토큰을 발급해 메일을 다시 보냄 (관리자·최고 관리자만) */
  async resend(
    organizationId: bigint,
    email: string,
    currentUser: CurrentUserPayload,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { members: true },
    });

    if (!org) {
      throw new AppException(ErrorCode.NOT_FOUND, '조직을 찾을 수 없습니다.');
    }

    this.assertOrgAdminForInvitations(
      org,
      currentUser,
      '초대 재전송 권한이 없습니다.',
    );

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: normalizedEmail,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new AppException(
        ErrorCode.NOT_FOUND,
        '재전송할 대기 중인 초대가 없습니다.',
      );
    }

    const cooldownMinutes = Number(
      this.configService.get<string>('INVITATION_RESEND_COOLDOWN_MINUTES', '5'),
    );
    if (invitation.lastSentAt) {
      const elapsedMs = Date.now() - invitation.lastSentAt.getTime();
      const cooldownMs = cooldownMinutes * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
        throw new AppException(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          `잠시 후 다시 시도해 주세요. (${waitSec}초 남음)`,
        );
      }
    }

    await this.clearInvitationRedis(invitation.id);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        lastSentAt: new Date(),
        resentCount: { increment: 1 },
      },
    });

    await this.persistInvitationToken(
      invitation.id,
      organizationId,
      normalizedEmail,
      invitation.roleToGrant,
      token,
      invitation.expiresAt,
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;
    const remainingHours = Math.max(
      1,
      Math.ceil(
        (invitation.expiresAt.getTime() - Date.now()) / (60 * 60 * 1000),
      ),
    );

    await this.mail.sendInvitationEmail({
      to: normalizedEmail,
      inviteeName: invitation.inviteeName ?? undefined,
      organizationName: org.name,
      inviteLink,
      expiresInHours: remainingHours,
    });

    return {
      message: '초대 이메일을 다시 보냈습니다.',
      email: normalizedEmail,
      expiresAt: invitation.expiresAt.toISOString(),
      resentCount: invitation.resentCount + 1,
    };
  }

  async getInvitationInfo(token: string) {
    const redisKey = `${INVITATION_TOKEN_PREFIX}${token}`;
    const redisData = await this.redis.get(redisKey);

    if (!redisData) {
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대 링크가 만료되었거나 유효하지 않습니다.',
      );
    }

    const { email, invitationId } = JSON.parse(redisData);

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: BigInt(invitationId) },
      include: { organization: true },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대가 만료되었거나 이미 처리되었습니다.',
      );
    }

    if (this.hashToken(token) !== invitation.tokenHash) {
      throw new AppException(
        ErrorCode.TOKEN_INVALID,
        '유효하지 않은 초대 링크입니다.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    return {
      email,
      organizationName: invitation.organization.name,
      needsSignUp: !existingUser,
    };
  }

  async signUpWithInvitation(dto: {
    token: string;
    password: string;
    displayName: string;
  }) {
    const redisKey = `${INVITATION_TOKEN_PREFIX}${dto.token}`;
    const redisData = await this.redis.get(redisKey);

    if (!redisData) {
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대 링크가 만료되었거나 유효하지 않습니다.',
      );
    }

    const { invitationId, organizationId, email, roleToGrant } =
      JSON.parse(redisData);

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: BigInt(invitationId) },
      include: { organization: true },
    });

    if (
      !invitation ||
      invitation.status !== InvitationStatus.PENDING ||
      invitation.expiresAt < new Date()
    ) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_EXPIRED,
        '초대가 만료되었거나 이미 처리되었습니다.',
      );
    }

    if (this.hashToken(dto.token) !== invitation.tokenHash) {
      await this.redis.del(redisKey);
      throw new AppException(
        ErrorCode.TOKEN_INVALID,
        '유효하지 않은 초대 링크입니다.',
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppException(
        ErrorCode.ALREADY_EXISTS,
        '이미 가입된 이메일입니다. 로그인 후 초대를 수락해 주세요.',
      );
    }

    const bcryptRounds = Number(
      this.configService.get<string>('BCRYPT_ROUNDS', '12'),
    );
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          profile: {
            create: {
              displayName: dto.displayName.trim(),
            },
          },
        },
        include: { profile: true },
      });

      await this.prisma.$transaction([
        this.prisma.organizationMember.create({
          data: {
            organizationId: BigInt(organizationId),
            userId: user.id,
            role: roleToGrant as OrgRole,
            isActive: true,
          },
        }),
        this.prisma.invitation.update({
          where: { id: BigInt(invitationId) },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedUserId: user.id,
            acceptedAt: new Date(),
          },
        }),
      ]);

      await this.clearInvitationRedis(BigInt(invitationId));
      await this.redis.del(redisKey);

      const accessPayload = {
        sub: user.id.toString(),
        email: user.email,
        organizationId,
        role: roleToGrant,
      };

      const refreshPayload = {
        sub: user.id.toString(),
        type: 'refresh',
      };

      const accessSecret =
        this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const refreshSecret =
        this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
      const accessExpiresIn = this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES_IN',
      );
      const refreshExpiresIn = this.configService.getOrThrow<string>(
        'JWT_REFRESH_EXPIRES_IN',
      );

      const accessToken = await this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      } as JwtSignOptions);

      const refreshToken = await this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      } as JwtSignOptions);

      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date();
      if (refreshExpiresIn.endsWith('d')) {
        expiresAt.setDate(
          expiresAt.getDate() + Number(refreshExpiresIn.slice(0, -1)),
        );
      } else if (refreshExpiresIn.endsWith('h')) {
        expiresAt.setHours(
          expiresAt.getHours() + Number(refreshExpiresIn.slice(0, -1)),
        );
      } else {
        expiresAt.setDate(expiresAt.getDate() + 7);
      }

      await this.prisma.auth_sessions.create({
        data: {
          user_id: user.id,
          current_organization_id: BigInt(organizationId),
          refresh_token_hash: refreshTokenHash,
          expires_at: expiresAt,
          status: 'ACTIVE',
        },
      });

      return {
        message: '회원가입이 완료되었고, 초대를 수락했습니다.',
        user: {
          id: user.id.toString(),
          email: user.email,
          displayName: user.profile?.displayName ?? null,
        },
        organization: {
          id: organizationId,
          name: invitation.organization.name,
          orgType: invitation.organization.orgType,
        },
        membership: {
          role: roleToGrant,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
      throw error;
    }
  }

  /**
   * 동일 조직·이메일에 PENDING 초대가 이미 있을 때: 409 대신 토큰·만료를 갱신해 메일 재발송.
   * (Redis 키 유실 등으로 링크만 죽고 DB에 PENDING만 남은 경우 재초대가 막히던 문제 완화)
   */
  private async refreshPendingInvitationAndSendMail(params: {
    invitation: {
      id: bigint;
      roleToGrant: OrgRole;
      inviteeName: string | null;
      resentCount: number;
      lastSentAt: Date | null;
    };
    org: { name: string };
    organizationId: bigint;
    email: string;
    dto: InviteDto;
    currentUser: CurrentUserPayload;
    expiresHours: number;
    ttlSeconds: number;
  }): Promise<{ message: string; email: string; expiresAt: string }> {
    const {
      invitation,
      org,
      organizationId,
      email,
      dto,
      currentUser,
      expiresHours,
      ttlSeconds,
    } = params;

    const cooldownMinutes = Number(
      this.configService.get<string>('INVITATION_RESEND_COOLDOWN_MINUTES', '5'),
    );
    if (invitation.lastSentAt) {
      const elapsedMs = Date.now() - invitation.lastSentAt.getTime();
      const cooldownMs = cooldownMinutes * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const waitSec = Math.ceil((cooldownMs - elapsedMs) / 1000);
        throw new AppException(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          `잠시 후 다시 시도해 주세요. (${waitSec}초 남음)`,
        );
      }
    }

    await this.clearInvitationRedis(invitation.id);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const roleToGrant = dto.roleToGrant ?? invitation.roleToGrant;
    const inviteeName =
      dto.inviteeName !== undefined && dto.inviteeName !== null
        ? dto.inviteeName.trim() || null
        : invitation.inviteeName;

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        expiresAt,
        roleToGrant,
        inviteeName,
        lastSentAt: new Date(),
        resentCount: { increment: 1 },
        invitedByUserId: BigInt(currentUser.sub),
      },
    });

    await this.persistInvitationToken(
      invitation.id,
      organizationId,
      email,
      roleToGrant,
      token,
      expiresAt,
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

    await this.mail.sendInvitationEmail({
      to: email,
      inviteeName: inviteeName ?? undefined,
      organizationName: org.name,
      inviteLink,
      expiresInHours: expiresHours,
    });

    return {
      message:
        '대기 중이던 초대가 있어 링크를 갱신하고 초대 메일을 다시 보냈습니다.',
      email,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private assertOrgAdminForInvitations(
    org: { members: { userId: bigint; role: OrgRole }[] },
    currentUser: CurrentUserPayload,
    message: string,
  ): void {
    const ok = org.members.some(
      (m) =>
        m.userId.toString() === currentUser.sub &&
        (m.role === OrgRole.ADMIN || m.role === OrgRole.SUPER_ADMIN),
    );
    if (!ok) {
      throw new AppException(ErrorCode.FORBIDDEN, message);
    }
  }

  private async persistInvitationToken(
    invitationId: bigint,
    organizationId: bigint,
    email: string,
    roleToGrant: OrgRole,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    const redisData = JSON.stringify({
      invitationId: invitationId.toString(),
      organizationId: organizationId.toString(),
      email,
      roleToGrant,
    });
    await this.redis.set(
      `${INVITATION_TOKEN_PREFIX}${token}`,
      redisData,
      ttlSeconds,
    );
    await this.redis.set(
      `${INVITATION_META_PREFIX}${invitationId}`,
      token,
      ttlSeconds,
    );
  }

  private async clearInvitationRedis(invitationId: bigint): Promise<void> {
    const metaKey = `${INVITATION_META_PREFIX}${invitationId}`;
    const oldToken = await this.redis.get(metaKey);
    if (oldToken) {
      await this.redis.del(`${INVITATION_TOKEN_PREFIX}${oldToken}`);
    }
    await this.redis.del(metaKey);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
