import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Snack Team' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: '1234567890',
    description: '선택. 사업자등록번호 등(조직 유형 구분 없음).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  businessNumber?: string;
}
