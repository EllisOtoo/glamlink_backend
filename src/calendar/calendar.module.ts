import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma';
import { CalendarService } from './calendar.service';

@Module({
  imports: [PrismaModule],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
