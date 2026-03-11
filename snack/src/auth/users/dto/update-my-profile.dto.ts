// src/users/dto/update-my-profile.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsUrl,
} from 'class-validator';

export class UpdateMyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl은 올바른 URL이어야 합니다.' })
  avatarUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-()\s]+$/, {
    message: '전화번호 형식이 올바르지 않습니다.',
  })
  phone?: string;
}
