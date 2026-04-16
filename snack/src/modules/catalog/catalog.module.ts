import { Module } from '@nestjs/common';
import { CategoryController } from './controllers/category.controller';
import { ProductController } from './controllers/product.controller';
import { CategoryService } from './services/category.service';
import { ProductService } from './services/product.service';

@Module({
  controllers: [CategoryController, ProductController],
  providers: [CategoryService, ProductService],
  exports: [CategoryService, ProductService],
})
export class CatalogModule {}
