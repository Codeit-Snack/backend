import { Role } from '../enums/role.enum';

export type JwtPayload = {
  sub: number;
  email: string;
  role: Role;
  organizationId?: number;
};
