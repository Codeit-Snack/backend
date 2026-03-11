import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { OrgRole, OrgType, Prisma, auth_sessions_status } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { PrismaService } from '../database/prisma.service';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  // =========================================================
  // 회원가입
  // ---------------------------------------------------------
  // 역할:
  // - 사용자 입력값 정리(trim, 소문자 변환)
  // - 조직 유형에 따른 businessNumber 유효성 검사
  // - 비밀번호 해시 생성
  // - Organization / OrganizationMember / User / UserProfile을
  //   Prisma nested create로 한 번에 생성
  // - 회원가입 완료 후 핵심 정보 반환
  // =========================================================
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

      // Prisma P2002:
      // 유니크 제약조건 위반. 여기서는 email 중복 가능성이 가장 큼
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

  // =========================================================
  // 로그인
  // ---------------------------------------------------------
  // 역할:
  // - 이메일/비밀번호 검증
  // - 활성 사용자 / 활성 조직 멤버십 확인
  // - refresh 세션(auth_sessions) 생성
  // - access token / refresh token 발급
  // - refresh token hash 저장
  // - 마지막 로그인 시각 갱신
  // =========================================================
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

    // 존재하지 않거나 비활성 사용자면 로그인 실패 처리
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

    // 현재는 가장 첫 번째 활성 멤버십을 기본 조직으로 사용
    const primaryMembership = user.memberships[0];

    if (!primaryMembership) {
      throw new UnauthorizedException('활성 조직 멤버십이 없습니다.');
    }

    // refresh token 만료시간을 미리 계산해서 세션에 저장
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    const refreshExpiresAt = this.getExpiryDate(refreshExpiresIn);

    // 세션을 먼저 만들고 sessionId를 토큰 payload에 포함시킴
    const session = await this.prisma.auth_sessions.create({
      data: {
        user_id: user.id,
        current_organization_id: primaryMembership.organizationId,
        refresh_token_hash: '',
        expires_at: refreshExpiresAt,
        status: auth_sessions_status.ACTIVE,
      },
    });

    // access token:
    // 사용자 정보 + 현재 조직 + role + sessionId 포함
    const accessPayload = {
      sub: user.id.toString(),
      email: user.email,
      organizationId: primaryMembership.organizationId.toString(),
      role: primaryMembership.role,
      sessionId: session.id.toString(),
    };

    // refresh token:
    // 최소 정보(sub, type, sessionId)만 포함
    const refreshPayload = {
      sub: user.id.toString(),
      type: 'refresh' as const,
      sessionId: session.id.toString(),
    };

    const accessToken = await this.signAccessToken(accessPayload);
    const refreshToken = await this.signRefreshToken(refreshPayload);

    // DB에는 refresh token 원문이 아니라 hash만 저장
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

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

    return {
      message: '로그인이 완료되었습니다.',
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

  // =========================================================
  // 토큰 재발급 (Refresh)
  // ---------------------------------------------------------
  // 역할:
  // - refresh token 서명 검증
  // - 세션 존재 여부 / 만료 여부 / 상태 확인
  // - DB에 저장된 refresh token hash와 비교
  // - 일치하면 access/refresh token 재발급
  // - 새 refresh token hash로 rotation 수행
  // - mismatch면 세션 revoke 처리
  // =========================================================
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

    const isRefreshTokenValid = await bcrypt.compare(
      dto.refreshToken,
      session.refresh_token_hash,
    );

    // refresh token hash가 다르면 재사용 공격 가능성으로 보고
    // 세션을 즉시 revoke 처리
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

    // 세션에 기록된 현재 조직 기준으로 멤버십 찾기
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

    // refresh token rotation:
    // 새 refresh token hash로 기존 값을 교체
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
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

  // =========================================================
  // 로그아웃
  // ---------------------------------------------------------
  // 역할:
  // - access token에 포함된 sessionId 기준으로 현재 세션 revoke
  // - 세션 상태를 ACTIVE -> REVOKED로 변경
  // - 이후 refresh token 재사용 방지
  // =========================================================
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

  // =========================================================
  // 내 정보 조회
  // ---------------------------------------------------------
  // 역할:
  // - access token의 sub / organizationId 기준으로 사용자 조회
  // - 현재 조직에서의 멤버십과 함께 내 정보 반환
  // - /api/auth/me 보호 API에서 사용
  // =========================================================
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

  // =========================================================
  // Access Token 발급 유틸
  // ---------------------------------------------------------
  // 역할:
  // - access token 서명 전용 공통 함수
  // - 로그인 / refresh 재발급 시 재사용
  // =========================================================
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

  // =========================================================
  // Refresh Token 발급 유틸
  // ---------------------------------------------------------
  // 역할:
  // - refresh token 서명 전용 공통 함수
  // - refresh token은 최소한의 식별 정보만 담아서 발급
  // =========================================================
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

  // =========================================================
  // Refresh Token 검증 유틸
  // ---------------------------------------------------------
  // 역할:
  // - JWT_REFRESH_SECRET으로 refresh token 서명 검증
  // - 검증 실패 시 UnauthorizedException 반환
  // =========================================================
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

  // =========================================================
  // 만료시간 계산 유틸
  // ---------------------------------------------------------
  // 역할:
  // - .env의 expiresIn 문자열(예: 7d, 24h, 30m)을 Date로 변환
  // - auth_sessions.expires_at 저장 시 사용
  // =========================================================
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

    // 예외적인 형식이면 기본 7일로 처리
    now.setDate(now.getDate() + 7);
    return now;
  }
}
