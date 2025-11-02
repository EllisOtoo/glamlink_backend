import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { FirebaseModule } from '../firebase';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OtpMailerService } from './otp-mailer.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PrismaModule, FirebaseModule],
  controllers: [AuthController],
  providers: [AuthService, OtpMailerService, SessionAuthGuard, RolesGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard, OtpMailerService],
})
export class AuthModule {}
