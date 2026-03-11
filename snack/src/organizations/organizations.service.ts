import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole, OrgType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  // 조직 생성
  async create(currentUser: CurrentUserPayload, dto: CreateOrganizationDto) {
    const name = dto.name.trim();
    const businessNumber = dto.businessNumber?.trim() ?? null;

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

    const organization = await this.prisma.organization.create({
      data: {
        name,
        orgType: dto.orgType,
        businessNumber:
          dto.orgType === OrgType.BUSINESS ? businessNumber : null,
        members: {
          create: {
            userId: BigInt(currentUser.sub),
            role: OrgRole.SUPER_ADMIN,
            isActive: true,
          },
        },
      },
      include: {
        members: {
          where: {
            userId: BigInt(currentUser.sub),
          },
        },
      },
    });

    const membership = organization.members[0];

    return {
      message: '조직 생성이 완료되었습니다.',
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
  }

  // 현재 조직 조회
  async getMyOrganization(currentUser: CurrentUserPayload) {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id: BigInt(currentUser.organizationId),
        members: {
          some: {
            userId: BigInt(currentUser.sub),
            isActive: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('조직을 찾을 수 없습니다.');
    }

    return {
      message: '조직 조회에 성공했습니다.',
      organization: {
        id: organization.id.toString(),
        name: organization.name,
        orgType: organization.orgType,
        businessNumber: organization.businessNumber,
      },
    };
  }

  // 조직 수정
  async update(
    currentUser: CurrentUserPayload,
    organizationId: string,
    dto: UpdateOrganizationDto,
  ) {
    if (currentUser.role !== OrgRole.SUPER_ADMIN) {
      throw new ForbiddenException('조직 수정 권한이 없습니다.');
    }

    const targetOrganizationId = BigInt(organizationId);

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: targetOrganizationId,
        userId: BigInt(currentUser.sub),
        isActive: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('해당 조직에 접근할 수 없습니다.');
    }

    const data: {
      name?: string;
      orgType?: OrgType;
      businessNumber?: string | null;
    } = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }

    if (dto.orgType !== undefined) {
      data.orgType = dto.orgType;
    }

    if (dto.businessNumber !== undefined) {
      data.businessNumber = dto.businessNumber?.trim() || null;
    }

    if (dto.orgType === OrgType.BUSINESS && !data.businessNumber) {
      throw new BadRequestException(
        'BUSINESS 조직은 businessNumber가 필요합니다.',
      );
    }

    if (dto.orgType === OrgType.PERSONAL && data.businessNumber) {
      throw new BadRequestException(
        'PERSONAL 조직은 businessNumber를 보낼 수 없습니다.',
      );
    }

    const organization = await this.prisma.organization.update({
      where: { id: targetOrganizationId },
      data,
    });

    return {
      message: '조직 수정이 완료되었습니다.',
      organization: {
        id: organization.id.toString(),
        name: organization.name,
        orgType: organization.orgType,
        businessNumber: organization.businessNumber,
      },
    };
  }

  // 현재 조직 멤버 목록 조회
  async getMembers(currentUser: CurrentUserPayload) {
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: BigInt(currentUser.organizationId),
        isActive: true,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return {
      message: '조직 멤버 목록 조회에 성공했습니다.',
      members: members.map((member) => ({
        membershipId: member.id.toString(),
        userId: member.userId.toString(),
        email: member.user.email,
        displayName: member.user.profile?.displayName ?? null,
        role: member.role,
        joinedAt: member.joinedAt,
      })),
    };
  }
}
