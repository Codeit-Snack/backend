import { IsString, MinLength } from 'class-validator';
import { ApiPasswordProperty } from '../../common/swagger/api-password.decorator';

export class ChangePasswordDto {
  @ApiPasswordProperty({ description: '현재 비밀번호' })
  @IsString()
  currentPassword: string;

  @ApiPasswordProperty({ description: '새 비밀번호 (최소 8자)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
