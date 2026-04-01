import { OrgRole } from '@prisma/client';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';

export function assertOrgAdmin(user: JwtPayload, message: string): void {
  if (user.role !== OrgRole.ADMIN && user.role !== OrgRole.SUPER_ADMIN) {
    throw new AppException(ErrorCode.FORBIDDEN, message);
  }
}
