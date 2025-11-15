import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { NotificationsService } from './notifications.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(SessionAuthGuard)
  @Post('tokens')
  async registerToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.notificationsService.registerPushToken(user.id, dto);
    return { registered: true };
  }
}
