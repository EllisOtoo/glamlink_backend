import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestWithAuth } from './decorators/current-user.decorator';

interface RequestOtpBody {
  email: string;
}

interface VerifyOtpBody {
  email: string;
  code: string;
  role?: UserRole;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(202)
  async requestOtp(@Body() body: RequestOtpBody): Promise<{ message: string }> {
    await this.authService.requestEmailOtp(body.email);
    return { message: 'OTP sent if email exists.' };
  }

  @Post('verify-otp')
  async verifyOtp(
    @Body() body: VerifyOtpBody,
    @Req() request: Request,
  ): Promise<{
    token: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      role: UserRole;
      lastSignedInAt: Date | null;
    };
  }> {
    const authSession = await this.authService.verifyEmailOtp({
      email: body.email,
      code: body.code,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });

    return {
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: {
        id: authSession.user.id,
        email: authSession.user.email,
        role: authSession.user.role,
        lastSignedInAt: authSession.user.lastSignedInAt,
      },
    };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: RequestWithAuth): Promise<void> {
    await this.authService.revokeSession(request.auth.session.id);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getProfile(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      role: UserRole;
      lastSignedInAt: Date | null;
    },
  ) {
    return user;
  }

  private extractClientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim();
    }

    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }

    return request.ip;
  }
}
