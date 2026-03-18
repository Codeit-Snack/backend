import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProductsService, CurrentUser } from '@/products/products.service';
import { CreateProductDto } from '@/products/dto/create-product.dto';
import { UpdateProductDto } from '@/products/dto/update-product.dto';
import { GetProductsQueryDto } from '@/products/dto/get-products-query.dto';

// 추후 인증 붙이면 @CurrentUser() 같은 커스텀 데코레이터로 교체
const mockCurrentUser: CurrentUser = {
  id: 1,
  currentOrganizationId: 1,
  role: 'ADMIN',
};

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(mockCurrentUser, createProductDto);
  }

  @Get()
  findAll(@Query() query: GetProductsQueryDto) {
    return this.productsService.findAll(mockCurrentUser, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(mockCurrentUser, Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(
      mockCurrentUser,
      Number(id),
      updateProductDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(mockCurrentUser, Number(id));
  }
}
