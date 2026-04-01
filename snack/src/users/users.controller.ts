import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/profile')
  @ApiOperation({ summary: '내 프로필 조회' })
  getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getMyProfile(BigInt(user.sub));
  }

  @Patch('me/profile')
  @ApiOperation({ summary: '내 프로필 수정' })
  updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(BigInt(user.sub), dto);
  }
}
