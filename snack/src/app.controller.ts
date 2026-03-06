import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      message: 'SNACK backend is running',
    };
  }
}
