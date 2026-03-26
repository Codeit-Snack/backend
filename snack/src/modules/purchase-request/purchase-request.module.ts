import { Module } from '@nestjs/common';
import { PurchaseRequestController } from './controllers/purchase-request.controller';
import { PurchaseRequestService } from './services/purchase-request.service';

@Module({
  controllers: [PurchaseRequestController],
  providers: [PurchaseRequestService],
  exports: [PurchaseRequestService],
})
export class PurchaseRequestModule {}
