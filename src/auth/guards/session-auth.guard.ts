import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { RequestWithAuth } from '../decorators/current-user.decorator';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuth | Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing session token.');
    }

    const { session, user } =
      await this.authService.validateSessionToken(token);

    (request as RequestWithAuth).auth = {
      token,
      session,
      user,
    };

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;

    if (header?.startsWith('Bearer ')) {
      return header.substring(7);
    }

    return undefined;
  }
}
