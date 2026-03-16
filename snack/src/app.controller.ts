import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: '헬스체크' })
  root() {
    return {
      message: 'SNACK backend is running!!',
    };
  }
}
