import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { OrgRole, OrgType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
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

    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

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

    const isPasswordValid = await bcrypt.compare(
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

    const accessPayload = {
      sub: user.id.toString(),
      email: user.email,
      organizationId: primaryMembership.organizationId.toString(),
      role: primaryMembership.role,
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
    const refreshExpiresAt = this.getExpiryDate(refreshExpiresIn);

    await this.prisma.auth_sessions.create({
      data: {
        user_id: user.id,
        current_organization_id: primaryMembership.organizationId,
        refresh_token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt,
        status: 'ACTIVE',
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
}
