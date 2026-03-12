import { OrgRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  role: OrgRole;
  sessionId: string;
};
