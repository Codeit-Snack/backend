import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

interface CurrentUserPayload {
  sub: string;
  email: string;
  orgId?: string | null;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me/profile')
  getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.getMyProfile(BigInt(user.sub));
  }

  @Patch('me/profile')
  updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(BigInt(user.sub), dto);
  }
}
