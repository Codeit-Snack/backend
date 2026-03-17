import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class DeclineInvitationDto {
  @ApiProperty({ description: '초대 링크의 토큰' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
