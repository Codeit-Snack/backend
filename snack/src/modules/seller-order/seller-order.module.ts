import { Module } from '@nestjs/common';
import { SellerOrderController } from './controllers/seller-order.controller';
import { SellerOrderService } from './services/seller-order.service';

@Module({
  controllers: [SellerOrderController],
  providers: [SellerOrderService],
  exports: [SellerOrderService],
})
export class SellerOrderModule {}
