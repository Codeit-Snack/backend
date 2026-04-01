import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return {
      userId: user.id.toString(),
      email: user.email,
      isActive: user.isActive,
      profile: {
        displayName: user.profile?.displayName ?? null,
        phone: user.profile?.phone ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        updatedAt: user.profile?.updatedAt ?? null,
      },
    };
  }

  async updateMyProfile(userId: bigint, dto: UpdateMyProfileDto) {
    await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true },
    });

    const profile = await this.prisma.userProfile.upsert({
      where: {
        userId,
      },
      update: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
      create: {
        userId,
        displayName: dto.displayName ?? null,
        phone: dto.phone ?? null,
        avatarUrl: dto.avatarUrl ?? null,
      },
    });

    return {
      userId: userId.toString(),
      profile: {
        displayName: profile.displayName,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        updatedAt: profile.updatedAt,
      },
    };
  }
}
