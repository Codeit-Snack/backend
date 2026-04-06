import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ErrorInterceptor } from '@/common/interceptors/error.interceptor';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  const port = Number(
    process.env.PORT ?? configService.get<string>('PORT', '3000'),
  );
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const throttleTtl = Number(configService.get<string>('THROTTLE_TTL', '60'));
  const throttleLimit = Number(
    configService.get<string>('THROTTLE_LIMIT', '10'),
  );

  // Render 등 리버스 프록시: X-Forwarded-For 신뢰. Config가 덮어쓰기 전에 process.env도 본다.
  const trustProxy =
    process.env.NODE_ENV === 'production' ||
    nodeEnv === 'production' ||
    process.env.TRUST_PROXY === '1' ||
    process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(
    rateLimit({
      windowMs: throttleTtl * 1000,
      max: throttleLimit,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        message: 'Too many requests. Please try again later.',
      },
    }),
  );

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

  const swaggerDescription = [
    'SNACK REST API — 인증·장바구니·구매 요청·판매자 주문·예산 등.',
    '',
    '**성공 응답** `{ "success": true, "data": ... }` (전역 인터셉터).',
    '',
    '**인증** `Authorization: Bearer <accessToken>`. UI **Authorize**에 토큰 입력.',
    'JWT `organizationId` = 현재 조직(장바구니·구매·판매 주문·예산 등).',
    '',
    '**스펙** `/api/openapi.json` · `/api/openapi.yaml` · UI `/api/docs`',
    '',
    '팀 온보딩: 저장소 `docs/TEAM.md`',
  ].join('\n');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SNACK API')
    .setDescription(swaggerDescription)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: '로그인 응답의 accessToken',
        in: 'header',
      },
      'access-token',
    )
    .addTag('Auth', '회원가입·로그인·토큰·비밀번호')
    .addTag('Users', '사용자')
    .addTag('Organizations', '조직·멤버')
    .addTag('Invitations', '초대')
    .addTag('Categories', '카탈로그 카테고리')
    .addTag('Products', '판매 상품')
    .addTag('Cart', '장바구니')
    .addTag('PurchaseRequest', '구매 요청(구매자)')
    .addTag('SellerOrder', '판매자 주문(PO)')
    .addTag('Budget', '예산·예약')
    .addTag('Expenses', '지출')
    .addTag('Audit', '감사 로그 조회')
    .addTag('Mail', '메일 테스트')
    .addTag('Health', '헬스체크')
    .addTag('App', '기타')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'openapi.json',
    yamlDocumentUrl: 'openapi.yaml',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  Logger.log(`HTTP ${port} (0.0.0.0)`, 'Bootstrap');
}
void bootstrap();
