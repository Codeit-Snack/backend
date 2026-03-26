import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseRequestStatus } from '@prisma/client';

export class PurchaseRequestItemResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  sellerOrganizationId!: number;

  @ApiPropertyOptional({ nullable: true })
  productId!: number | null;

  @ApiProperty()
  productNameSnapshot!: string;

  @ApiPropertyOptional({ nullable: true })
  productUrlSnapshot!: string | null;

  @ApiProperty({ description: '단가 스냅샷 (문자열)' })
  unitPriceSnapshot!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: '라인 합계 (문자열)' })
  lineTotal!: string;

  @ApiProperty()
  createdAt!: string;
}

export class PurchaseRequestSummaryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ enum: PurchaseRequestStatus })
  status!: PurchaseRequestStatus;

  @ApiProperty({ description: '총액 (문자열)' })
  totalAmount!: string;

  @ApiProperty()
  requestedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  canceledAt!: string | null;

  @ApiProperty({ description: '라인 개수' })
  itemCount!: number;
}

export class PurchaseRequestDetailResponseDto extends PurchaseRequestSummaryResponseDto {
  @ApiProperty({ example: 1 })
  buyerOrganizationId!: number;

  @ApiProperty({ example: 1 })
  requesterUserId!: number;

  @ApiPropertyOptional({ nullable: true })
  requestMessage!: string | null;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [PurchaseRequestItemResponseDto] })
  items!: PurchaseRequestItemResponseDto[];
}
