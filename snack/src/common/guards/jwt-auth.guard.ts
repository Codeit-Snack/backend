import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const accessToken = request.cookies?.access_token as string | undefined;

    if (!accessToken) {
      throw new UnauthorizedException('Access token is missing.');
    }

    return true;
  }
}
