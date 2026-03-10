import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgRole, OrgType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignUpDto } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
}
