import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { ReplyReviewDto } from './dto/reply-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post(':reviewId/reply')
  async replyToReview(
    @CurrentUser() user: User,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.replyToReview(user, reviewId, dto);
  }

  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendors/me')
  async listVendorReviews(
    @CurrentUser() user: User,
    @Query('pendingOnly') pendingOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Number.isFinite(Number(limit)) ? Number(limit) : undefined;
    const pending =
      pendingOnly === 'true' || pendingOnly === '1' ? true : undefined;
    return this.reviewsService.listVendorReviews(user, {
      pendingOnly: pending,
      take,
    });
  }
}
