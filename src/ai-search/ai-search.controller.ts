import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiSearchService } from './ai-search.service';
import { AiSearchRequestDto, AiSearchResponseDto } from './ai-search.dto';

@ApiTags('AiSearch')
@Controller('search/ai')
export class AiSearchController {
  constructor(private readonly aiSearchService: AiSearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search services using natural language',
    description:
      'Parses a free-form booking request, generates semantic search embeddings, and returns ranked service matches.',
  })
  @ApiBody({ type: AiSearchRequestDto })
  @ApiOkResponse({ type: AiSearchResponseDto })
  async search(@Body() body: AiSearchRequestDto) {
    return this.aiSearchService.search(body);
  }
}
