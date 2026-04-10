import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { SellerOrderModule } from '@/modules/seller-order/seller-order.module';
import { PurchaseRequestController } from '@/modules/purchase-request/controllers/purchase-request.controller';
import { PurchaseRequestService } from '@/modules/purchase-request/services/purchase-request.service';

@Module({
  imports: [AuditModule, SellerOrderModule],
  controllers: [PurchaseRequestController],
  providers: [PurchaseRequestService],
  exports: [PurchaseRequestService],
})
export class PurchaseRequestModule {}
