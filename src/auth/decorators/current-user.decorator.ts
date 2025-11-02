import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Session, User } from '@prisma/client';

export interface RequestWithAuth extends Request {
  auth: {
    token: string;
    session: Session;
    user: User;
  };
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    return request.auth?.user;
  },
);
