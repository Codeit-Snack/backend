import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

function isValidPositiveEntityId(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') {
    return false;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1;
}

/** JWT 등으로 `request.user.organizationId` / `request.user.sub` 가 채워져 있어야 함. */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.organizationId ?? request.user?.organizationId;
    if (!isValidPositiveEntityId(raw)) {
      throw new UnauthorizedException(
        '조직 컨텍스트가 없습니다. 로그인 및 조직 선택 후 다시 시도해 주세요.',
      );
    }
    return Number(raw);
  },
);

export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.userId ?? request.user?.sub;
    if (!isValidPositiveEntityId(raw)) {
      throw new UnauthorizedException(
        '사용자 컨텍스트가 없습니다. 로그인 후 다시 시도해 주세요.',
      );
    }
    return Number(raw);
  },
);
