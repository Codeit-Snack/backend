import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as fs from 'node:fs';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { ErrorInterceptor } from '@/common/interceptors/error.interceptor';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';

function loadHttpsOptions():
  | { key: Buffer; cert: Buffer }
  | undefined {
  const keyPath = process.env.HTTPS_KEY_PATH?.trim();
  const certPath = process.env.HTTPS_CERT_PATH?.trim();
  if (
    !keyPath ||
    !certPath ||
    !fs.existsSync(keyPath) ||
    !fs.existsSync(certPath)
  ) {
    return undefined;
  }
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

async function bootstrap() {
  const httpsOptions = loadHttpsOptions();
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    httpsOptions ? { httpsOptions } : undefined,
  );

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
      hsts:
        nodeEnv === 'production'
          ? { maxAge: 31_536_000, includeSubDomains: true }
          : false,
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

  const swaggerPublicUrl = configService
    .get<string>('SWAGGER_PUBLIC_URL', '')
    .trim();

  const swaggerDescription = [
    'SNACK REST API — 인증·장바구니·구매 요청·판매자 주문·예산 등.',
    '',
    '**성공 응답** `{ "success": true, "data": ... }` (전역 인터셉터).',
    '',
    '**인증** `Authorization: Bearer <accessToken>`. UI **Authorize**에 토큰 입력.',
    'JWT `organizationId` = 현재 조직(장바구니·구매·판매 주문·예산 등).',
    '',
    '**OpenAPI** 이 문서는 서버 기동 시 컨트롤러·DTO 데코레이터에서 **자동 생성**됩니다 (`@nestjs/swagger` 플러그인·`nest-cli.json`). 수동으로 `openapi.yaml`을 편집하지 않아도 코드 변경이 곧 스펙 변경입니다.',
    '',
    '**비밀번호·전송** 비밀번호 필드는 스펙상 `format: password`, `writeOnly`로 표시됩니다. **네트워크 구간 암호화는 HTTPS(TLS)** 가 담당합니다. 로컬에서 `http://` 로 호출하면 개발자 도구 Network에 JSON 본문이 그대로 보이는 것이 정상입니다. 로컬 HTTPS는 `HTTPS_KEY_PATH` / `HTTPS_CERT_PATH`(PEM)로 활성화할 수 있습니다.',
    '',
    '**스펙** `/api/openapi.json` · `/api/openapi.yaml` · UI `/api/docs`',
    '',
    '팀 온보딩: 저장소 `docs/TEAM.md`',
  ].join('\n');

  const swaggerBuilder = new DocumentBuilder()
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
    .addTag(
      'Budget',
      [
        '구매자 조직 기준 월별 예산(budget_periods)과 판매자 주문(PO) 단위 예산 예약(budget_reservations).',
        '월 상한은 연·월당 1행; 예약은 PO당 1행(ACTIVE→RELEASED/CONSUMED).',
        '`/budget/monthly-default`는 조직의 “매달 시작 예산” 기본값(organizations.default_monthly_budget).',
        '월별 행이 없을 때 첫 조회·요약·잔액 계산 시 기본값으로 행이 자동 생성됨.',
      ].join(' '),
    )
    .addTag('Expenses', '지출')
    .addTag('Audit', '감사 로그 조회')
    .addTag('Mail', '메일 테스트')
    .addTag('Health', '헬스체크')
    .addTag('App', '기타');

  if (swaggerPublicUrl) {
    swaggerBuilder.addServer(
      swaggerPublicUrl.replace(/\/$/, ''),
      '배포·공개 URL (Try it out)',
    );
  }
  swaggerBuilder.addServer(
    `${httpsOptions ? 'https' : 'http'}://localhost:${port}`,
    '로컬 (현재 프로토콜)',
  );

  const swaggerConfig = swaggerBuilder.build();

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
  Logger.log(
    `${httpsOptions ? 'HTTPS' : 'HTTP'} ${port} (0.0.0.0)`,
    'Bootstrap',
  );
}
void bootstrap();
