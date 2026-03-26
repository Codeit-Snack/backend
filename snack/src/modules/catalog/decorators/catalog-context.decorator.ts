import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 인증/미들웨어에서 request.organizationId 또는 request.user?.organizationId 설정을 가정.
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.organizationId ?? request.user?.organizationId;
    const n = Number(value);
    if (Number.isNaN(n) || n < 1) {
      return 1;
    }
    return n;
  },
);

/**
 * 인증/미들웨어에서 request.userId 또는 request.user?.sub 설정을 가정.
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.userId ?? request.user?.sub;
    const n = Number(value);
    if (Number.isNaN(n) || n < 1) {
      return 1;
    }
    return n;
  },
);
