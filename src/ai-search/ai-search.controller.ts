import { Controller, Post, Body } from '@nestjs/common';
import { AiSearchService } from './ai-search.service';
import { AiSearchRequestDto } from './ai-search.dto';

@Controller('search/ai')
export class AiSearchController {
  constructor(private readonly aiSearchService: AiSearchService) {}

  @Post()
  async search(@Body() body: AiSearchRequestDto) {
    return this.aiSearchService.search(body);
  }
}
