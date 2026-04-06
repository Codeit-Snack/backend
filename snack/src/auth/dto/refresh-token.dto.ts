import { IsNotEmpty, IsString } from 'class-validator';
import { ApiPasswordProperty } from '@/common/swagger/api-password.decorator';

export class RefreshTokenDto {
  @ApiPasswordProperty({
    description:
      '로그인 응답의 refreshToken. 전송은 HTTPS 권장. 스펙상 민감 필드로 표시.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
