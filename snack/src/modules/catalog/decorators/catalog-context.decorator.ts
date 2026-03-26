import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 인증/미들웨어에서 request.organizationId 또는 request.user?.organizationId 를 설정해야 함.
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.organizationId ?? request.user?.organizationId;
    const n = Number(raw);
    if (
      raw === undefined ||
      raw === null ||
      raw === '' ||
      Number.isNaN(n) ||
      n < 1
    ) {
      throw new UnauthorizedException(
        '조직 컨텍스트가 없습니다. 로그인 및 조직 선택 후 다시 시도해 주세요.',
      );
    }
    return n;
  },
);

/**
 * 인증/미들웨어에서 request.userId 또는 request.user?.sub 를 설정해야 함.
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.userId ?? request.user?.sub;
    const n = Number(raw);
    if (
      raw === undefined ||
      raw === null ||
      raw === '' ||
      Number.isNaN(n) ||
      n < 1
    ) {
      throw new UnauthorizedException(
        '사용자 컨텍스트가 없습니다. 로그인 후 다시 시도해 주세요.',
      );
    }
    return n;
  },
);
