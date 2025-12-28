import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { CreatePayoutMethodDto } from './dto/create-payout-method.dto';
import { CreatePayoutRequestDto } from './dto/create-payout-request.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';

@Controller('payouts')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('wallet')
  async getWallet(@CurrentUser() user: User) {
    return this.payoutsService.getWalletBalance(user.id);
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: User,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.payoutsService.listTransactions(
      user.id,
      take ? parseInt(take) : 50,
      skip ? parseInt(skip) : 0,
    );
  }

  @Post('request')
  async requestPayout(
    @CurrentUser() user: User,
    @Body() dto: CreatePayoutRequestDto,
  ) {
    return this.payoutsService.createPayoutRequest(
      user.id,
      dto.amountPesewas,
      dto.payoutMethodId,
    );
  }

  @Get('requests')
  async getPayoutRequests(
    @CurrentUser() user: User,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.payoutsService.listPayoutRequests(
      user.id,
      take ? parseInt(take) : 50,
      skip ? parseInt(skip) : 0,
    );
  }

  // Payout Method Management
  @Post('methods')
  async addMethod(
    @CurrentUser() user: User,
    @Body() dto: CreatePayoutMethodDto,
  ) {
    return this.payoutsService.addPayoutMethod(user.id, dto);
  }

  @Get('methods')
  async getMethods(@CurrentUser() user: User) {
    return this.payoutsService.listPayoutMethods(user.id);
  }

  @Delete('methods/:id')
  async deleteMethod(@CurrentUser() user: User, @Param('id') id: string) {
    return this.payoutsService.deletePayoutMethod(user.id, id);
  }
}
