import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ description: '소속 조직 ID', example: 1 })
  organizationId!: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  parentId!: number | null;

  @ApiProperty({ example: '음료' })
  name!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt!: string;
}
