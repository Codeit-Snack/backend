import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

type SameSite = 'lax' | 'strict' | 'none';

function getCookieBaseOptions(configService: ConfigService) {
  const secure = configService.get<string>('COOKIE_SECURE', 'false') === 'true';
  const sameSite = configService.get<string>(
    'COOKIE_SAMESITE',
    'lax',
  ) as SameSite;
  const domain = configService.get<string>('COOKIE_DOMAIN', 'localhost');

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
  } as const;
}

export function setAccessTokenCookie(
  response: Response,
  configService: ConfigService,
  token: string,
): void {
  response.cookie('access_token', token, {
    ...getCookieBaseOptions(configService),
    maxAge: 15 * 60 * 1000,
  });
}

export function setRefreshTokenCookie(
  response: Response,
  configService: ConfigService,
  token: string,
): void {
  response.cookie('refresh_token', token, {
    ...getCookieBaseOptions(configService),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(
  response: Response,
  configService: ConfigService,
): void {
  const baseOptions = getCookieBaseOptions(configService);

  response.clearCookie('access_token', baseOptions);
  response.clearCookie('refresh_token', baseOptions);
}
