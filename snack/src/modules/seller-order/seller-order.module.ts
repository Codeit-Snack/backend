import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SellerOrderController } from './seller-order.controller';
import { SellerOrderService } from './seller-order.service';

@Module({
  imports: [AuditModule],
  controllers: [SellerOrderController],
  providers: [SellerOrderService],
})
export class SellerOrderModule {}
