import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ErrorInterceptor } from '../src/common/interceptors/error.interceptor';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

/** main.ts와 동일한 글로벌 설정(프리픽스·파이프·응답 래핑)으로 부팅 */
export async function createE2eApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  const nodeEnv = 'test';

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(nodeEnv));
  app.useGlobalInterceptors(
    new ErrorInterceptor(nodeEnv),
    new ResponseInterceptor(),
  );

  await app.init();
  return app;
}
