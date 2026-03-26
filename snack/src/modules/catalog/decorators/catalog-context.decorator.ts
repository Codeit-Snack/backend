import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 요청 컨텍스트에서 조직 ID를 반환.
 * 인증/미들웨어에서 request.organizationId 또는 request.user?.organizationId 설정을 가정.
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.organizationId ?? request.user?.organizationId;
    const n = Number(value);
    if (Number.isNaN(n) || n < 1) {
      return 1; // 개발용 기본값; 실제로는 Guard에서 검증 권장
    }
    return n;
  },
);

/**
 * 요청 컨텍스트에서 사용자 ID를 반환.
 * 인증/미들웨어에서 request.userId 또는 request.user?.sub 설정을 가정.
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.userId ?? request.user?.sub;
    const n = Number(value);
    if (Number.isNaN(n) || n < 1) {
      return 1; // 개발용 기본값; 실제로는 Guard에서 검증 권장
    }
    return n;
  },
);
