import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole, OrgType, Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma.service';
import type { CurrentUserPayload } from '@/auth/decorators/current-user.decorator';
import { CreateOrganizationDto } from '@/organizations/dto/create-organization.dto';
import { UpdateOrganizationDto } from '@/organizations/dto/update-organization.dto';
import { UpdateOrganizationMemberRoleDto } from '@/organizations/dto/update-organization-member-role.dto';
import { OrganizationMembersQueryDto } from '@/organizations/dto/organization-members-query.dto';

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

  // 현재 조직 멤버 목록 조회 (검색·페이지네이션)
  async getMembers(
    currentUser: CurrentUserPayload,
    query: OrganizationMembersQueryDto = {},
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const q = query.q?.trim();
    const userWhere: Prisma.UserWhereInput | undefined =
      q && q.length > 0
        ? {
            OR: [
              { email: { contains: q } },
              {
                profile: {
                  is: { displayName: { contains: q } },
                },
              },
            ],
          }
        : undefined;

    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId: BigInt(currentUser.organizationId),
      isActive: true,
      ...(userWhere != null && { user: userWhere }),
    };

    const [members, total] = await Promise.all([
      this.prisma.organizationMember.findMany({
        where,
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
        skip,
        take: limit,
      }),
      this.prisma.organizationMember.count({ where }),
    ]);

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
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // 현재 조직 멤버 권한 변경
  async updateMemberRole(
    currentUser: CurrentUserPayload,
    memberId: bigint,
    dto: UpdateOrganizationMemberRoleDto,
  ): Promise<{
    message: string;
    member: {
      membershipId: string;
      userId: string;
      organizationId: string;
      role: OrgRole;
      isActive: boolean;
    };
  }> {
    if (!currentUser.organizationId) {
      throw new ForbiddenException('현재 조직 정보가 없습니다.');
    }

    const organizationId = BigInt(currentUser.organizationId);

    const actorMembership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: BigInt(currentUser.sub),
        isActive: true,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!actorMembership) {
      throw new ForbiddenException('현재 조직의 활성 멤버가 아닙니다.');
    }

    if (
      actorMembership.role !== OrgRole.ADMIN &&
      actorMembership.role !== OrgRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('권한을 변경할 수 없습니다.');
    }

    const targetMembership = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        isActive: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('대상 멤버를 찾을 수 없습니다.');
    }

    if (targetMembership.userId.toString() === currentUser.sub) {
      throw new BadRequestException('자기 자신의 권한은 변경할 수 없습니다.');
    }

    if (targetMembership.role === OrgRole.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN 권한은 변경할 수 없습니다.');
    }

    if (dto.role === OrgRole.SUPER_ADMIN) {
      throw new ForbiddenException('SUPER_ADMIN 권한으로 변경할 수 없습니다.');
    }

    if (targetMembership.role === dto.role) {
      throw new BadRequestException('이미 동일한 권한입니다.');
    }

    const updatedMembership = await this.prisma.organizationMember.update({
      where: {
        id: targetMembership.id,
      },
      data: {
        role: dto.role,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        isActive: true,
      },
    });

    return {
      message: '조직 멤버 권한이 변경되었습니다.',
      member: {
        membershipId: updatedMembership.id.toString(),
        userId: updatedMembership.userId.toString(),
        organizationId: updatedMembership.organizationId.toString(),
        role: updatedMembership.role,
        isActive: updatedMembership.isActive,
      },
    };
  }

  // 현재 조직 멤버 비활성화
  async deactivateMember(
    currentUser: CurrentUserPayload,
    memberId: bigint,
  ): Promise<{
    message: string;
    member: {
      membershipId: string;
      userId: string;
      organizationId: string;
      role: OrgRole;
      isActive: boolean;
    };
  }> {
    if (!currentUser.organizationId) {
      throw new ForbiddenException('현재 조직 정보가 없습니다.');
    }

    const organizationId = BigInt(currentUser.organizationId);

    const actorMembership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: BigInt(currentUser.sub),
        isActive: true,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!actorMembership) {
      throw new ForbiddenException('현재 조직의 활성 멤버가 아닙니다.');
    }

    if (
      actorMembership.role !== OrgRole.ADMIN &&
      actorMembership.role !== OrgRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('멤버를 비활성화할 권한이 없습니다.');
    }

    const targetMembership = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        isActive: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('대상 멤버를 찾을 수 없습니다.');
    }

    if (!targetMembership.isActive) {
      throw new BadRequestException('이미 비활성화된 멤버입니다.');
    }

    if (targetMembership.userId.toString() === currentUser.sub) {
      throw new BadRequestException('자기 자신은 비활성화할 수 없습니다.');
    }

    if (targetMembership.role === OrgRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'SUPER_ADMIN 멤버는 비활성화할 수 없습니다.',
      );
    }

    const updatedMembership = await this.prisma.organizationMember.update({
      where: {
        id: targetMembership.id,
      },
      data: {
        isActive: false,
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        isActive: true,
      },
    });

    return {
      message: '조직 멤버가 비활성화되었습니다.',
      member: {
        membershipId: updatedMembership.id.toString(),
        userId: updatedMembership.userId.toString(),
        organizationId: updatedMembership.organizationId.toString(),
        role: updatedMembership.role,
        isActive: updatedMembership.isActive,
      },
    };
  }
}
