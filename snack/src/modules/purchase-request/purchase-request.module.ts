import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SellerOrderModule } from '../seller-order/seller-order.module';
import { PurchaseRequestController } from './controllers/purchase-request.controller';
import { PurchaseRequestService } from './services/purchase-request.service';

@Module({
  imports: [AuditModule, SellerOrderModule],
  controllers: [PurchaseRequestController],
  providers: [PurchaseRequestService],
  exports: [PurchaseRequestService],
})
export class PurchaseRequestModule {}
