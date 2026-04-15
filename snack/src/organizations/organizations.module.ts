import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { OrganizationsController } from '@/organizations/organizations.controller';
import { OrganizationsService } from '@/organizations/organizations.service';

@Module({
  imports: [PrismaModule, CatalogModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
