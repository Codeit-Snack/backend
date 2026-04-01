import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { SellerOrderController } from '@/modules/seller-order/seller-order.controller';
import { SellerOrderService } from '@/modules/seller-order/seller-order.service';

@Module({
  imports: [AuditModule],
  controllers: [SellerOrderController],
  providers: [SellerOrderService],
})
export class SellerOrderModule {}
