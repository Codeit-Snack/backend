import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { OrganizationsController } from '@/organizations/organizations.controller';
import { OrganizationsService } from '@/organizations/organizations.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
