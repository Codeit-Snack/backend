import { Module } from '@nestjs/common';
import { CartController } from '@/modules/cart/controllers/cart.controller';
import { CartService } from '@/modules/cart/services/cart.service';

@Module({
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
