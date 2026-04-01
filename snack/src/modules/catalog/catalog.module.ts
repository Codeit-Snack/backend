import { Module } from '@nestjs/common';
import { CategoryController } from '@/modules/catalog/controllers/category.controller';
import { ProductController } from '@/modules/catalog/controllers/product.controller';
import { CategoryService } from '@/modules/catalog/services/category.service';
import { ProductService } from '@/modules/catalog/services/product.service';

@Module({
  controllers: [CategoryController, ProductController],
  providers: [CategoryService, ProductService],
  exports: [CategoryService, ProductService],
})
export class CatalogModule {}
