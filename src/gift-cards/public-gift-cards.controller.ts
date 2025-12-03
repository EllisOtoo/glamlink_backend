import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { LookupGiftCardQueryDto } from './dto/lookup-gift-card.dto';
import { GiftCardsService } from './gift-cards.service';

@Controller('public/gift-cards')
export class PublicGiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Post()
  create(@Body() dto: CreateGiftCardDto) {
    return this.giftCards.createGiftCardPurchase(dto);
  }

  @Get(':code')
  lookup(
    @Param('code') code: string,
    @Query() query: LookupGiftCardQueryDto,
  ) {
    return this.giftCards.getGiftCardForPublic(code, query.email);
  }
}
