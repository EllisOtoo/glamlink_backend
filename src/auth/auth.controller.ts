import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService, VendorContext } from './auth.service';
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
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    token: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      role: UserRole;
      lastSignedInAt: Date | null;
    };
    vendor: ReturnType<AuthController['mapVendor']>;
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

    this.setTokenCookie(response, authSession.token);

    return {
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: {
        id: authSession.user.id,
        email: authSession.user.email,
        role: authSession.user.role,
        lastSignedInAt: authSession.user.lastSignedInAt,
      },
      vendor: this.mapVendor(authSession.vendor),
    };
  }

  @Post('firebase-login')
  async firebaseLogin(
    @Body() body: FirebaseLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{
    token: string;
    expiresAt: Date;
    user: {
      id: string;
      email: string;
      role: UserRole;
      lastSignedInAt: Date | null;
    };
    vendor: ReturnType<AuthController['mapVendor']>;
  }> {
    const authSession = await this.authService.loginWithFirebaseIdToken({
      idToken: body.idToken,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });

    this.setTokenCookie(response, authSession.token);

    return {
      token: authSession.token,
      expiresAt: authSession.expiresAt,
      user: {
        id: authSession.user.id,
        email: authSession.user.email,
        role: authSession.user.role,
        lastSignedInAt: authSession.user.lastSignedInAt,
      },
      vendor: this.mapVendor(authSession.vendor),
    };
  }

  @Post('register')
  async firebaseRegisterJwt(
    @Body() body: FirebaseRegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.registerWithFirebaseIdToken({
      idToken: body.idToken,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });

    this.setTokenCookie(response, result.access_token);
    return result;
  }

  @Post('login')
  async firebaseLoginJwt(
    @Body() body: FirebaseLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithFirebaseJwt({
      idToken: body.idToken,
      requestedRole: body.role,
      metadata: {
        userAgent: request.headers['user-agent'],
        clientIp: this.extractClientIp(request),
      },
    });

    this.setTokenCookie(response, result.access_token);
    return result;
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(204)
  async logout(
    @Req() request: RequestWithAuth,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (request.auth.session?.id) {
      await this.authService.revokeSession(request.auth.session.id);
    }
    this.clearTokenCookie(response);
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async getProfile(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      role: UserRole;
      lastSignedInAt: Date | null;
    },
  ) {
    const vendor = await this.authService.getVendorContextByUserId(user.id);
    const customerProfile = await this.authService.getCustomerProfile(user.id);
    
    return {
      ...user,
      vendor: this.mapVendor(vendor),
      customerProfile,
    };
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

  private mapVendor(vendor: VendorContext | null) {
    if (!vendor) {
      return null;
    }
    return {
      id: vendor.id,
      handle: vendor.handle,
      status: vendor.status,
    };
  }

  private setTokenCookie(response: Response, token: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('access_token', token, {
      httpOnly: true,
      secure: true, // Must be true for SameSite=None
      // sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-origin
      sameSite: 'none', // 'none' required for cross-origin
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });
  }

  private clearTokenCookie(response: Response) {
    response.clearCookie('access_token', {
      path: '/',
    });
  }
}
