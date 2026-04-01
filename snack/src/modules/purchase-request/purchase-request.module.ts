import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PurchaseRequestController } from './controllers/purchase-request.controller';
import { PurchaseRequestService } from './services/purchase-request.service';

@Module({
  imports: [AuditModule],
  controllers: [PurchaseRequestController],
  providers: [PurchaseRequestService],
  exports: [PurchaseRequestService],
})
export class PurchaseRequestModule {}
