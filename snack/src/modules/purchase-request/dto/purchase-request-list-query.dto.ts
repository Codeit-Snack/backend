import { ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { PurchaseRequestListSort } from './purchase-request-list-sort.enum';

export class PurchaseRequestListQueryDto {
  @ApiPropertyOptional({
    enum: PurchaseRequestStatus,
    description: '상태 필터',
  })
  @IsOptional()
  @IsEnum(PurchaseRequestStatus)
  status?: PurchaseRequestStatus;

  @ApiPropertyOptional({
    enum: PurchaseRequestListSort,
    default: PurchaseRequestListSort.RequestedAtDesc,
    description: '정렬: 요청일 내림차순(기본), 총액 오름/내림차순',
  })
  @IsOptional()
  @IsEnum(PurchaseRequestListSort)
  sort?: PurchaseRequestListSort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
