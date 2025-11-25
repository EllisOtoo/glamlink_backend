import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestWithAuth } from './decorators/current-user.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';
import { FirebaseRegisterDto } from './dto/firebase-register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(202)
  async requestOtp(@Body() body: RequestOtpDto): Promise<{ message: string }> {
    await this.authService.requestEmailOtp(body.email);
    return { message: 'OTP sent if email exists.' };
  }

  @Post('verify-otp')
  async verifyOtp(
    @Body() body: VerifyOtpDto,
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

  @Post('firebase-login')
  async firebaseLogin(
    @Body() body: FirebaseLoginDto,
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
    const authSession = await this.authService.loginWithFirebaseIdToken({
      idToken: body.idToken,
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

  @Post('register')
  async firebaseRegisterJwt(
    @Body() body: FirebaseRegisterDto,
    @Req() request: Request,
  ) {
    return this.authService.registerWithFirebaseIdToken({
      idToken: body.idToken,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });
  }

  @Post('login')
  async firebaseLoginJwt(
    @Body() body: FirebaseLoginDto,
    @Req() request: Request,
  ) {
    return this.authService.loginWithFirebaseJwt({
      idToken: body.idToken,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logout(@Req() request: RequestWithAuth): Promise<void> {
    if (request.auth.session?.id) {
      await this.authService.revokeSession(request.auth.session.id);
    }
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
