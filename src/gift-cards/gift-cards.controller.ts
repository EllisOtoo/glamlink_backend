import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { GiftCardsService } from './gift-cards.service';

@Controller()
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/gift-cards')
  listForVendor(@CurrentUser() user: User, @Query('take') take?: string) {
    const parsed = Number.parseInt(take ?? '', 10);
    const limit = Number.isFinite(parsed) ? parsed : 20;
    return this.giftCards.listVendorGiftCards(user.id, limit);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me/gift-cards/:giftCardId')
  getVendorGiftCard(
    @CurrentUser() user: User,
    @Param('giftCardId') giftCardId: string,
  ) {
    return this.giftCards.getVendorGiftCard(user.id, giftCardId);
  }
}
