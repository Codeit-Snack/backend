import { Module } from '@nestjs/common';
import { AuditModule } from '@/modules/audit/audit.module';
import { FinanceModule } from '@/modules/finance/finance.module';
import { SellerOrderController } from '@/modules/seller-order/controllers/seller-order.controller';
import { SellerOrderService } from '@/modules/seller-order/services/seller-order.service';

@Module({
  imports: [AuditModule, FinanceModule],
  controllers: [SellerOrderController],
  providers: [SellerOrderService],
  exports: [SellerOrderService],
})
export class SellerOrderModule {}
