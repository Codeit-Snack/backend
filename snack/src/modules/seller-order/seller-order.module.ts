import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';
import { SellerOrderController } from './controllers/seller-order.controller';
import { SellerOrderService } from './services/seller-order.service';

@Module({
  imports: [AuditModule, FinanceModule],
  controllers: [SellerOrderController],
  providers: [SellerOrderService],
  exports: [SellerOrderService],
})
export class SellerOrderModule {}
