import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ParsedQuery } from './ai-search.dto';
import { resolveNaturalDate } from './date-resolution.util';

@Injectable()
export class QueryParserService {
  private readonly logger = new Logger(QueryParserService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey: apiKey || '' });
  }

  async parseQuery(query: string, userTimeZone = 'Africa/Accra'): Promise<ParsedQuery> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert NLP parser for a beauty and grooming booking app.
Your task is to extract booking intents from user queries.
Current date/time context: ${new Date().toISOString()}
Timezone: ${userTimeZone}

Extract the following:
- serviceIntent: The core service requested (e.g., "knotless braids", "haircut", "massage"). Keep it concise.
- location: The neighborhood or city mentioned (e.g., "East Legon", "Osu"). Null if not provided.
- dateTime: The natural language time requested (e.g., "tomorrow morning", "next Friday"). Null if not provided.
- resolvedDate: Convert the dateTime to a specific YYYY-MM-DD format based on the current date context. Null if no date is implied.
- timeRange: If a specific time of day is requested (morning, afternoon, 2pm), convert it to an object with start and end in minutes past midnight (e.g. 2pm = { "start": 840, "end": 900 }). Morning is typically 480-720 (8am-12pm). Afternoon is 720-1020 (12pm-5pm). Evening is 1020-1320 (5pm-10pm). Null if not applicable.

Output exactly as a JSON object matching this schema.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      });

      const resultText = completion.choices[0].message.content;
      if (!resultText) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(resultText) as ParsedQuery;
      
      // Ensure lowercased intent
      if (parsed.serviceIntent) {
        parsed.serviceIntent = parsed.serviceIntent.toLowerCase();
      }

      const deterministicResolvedDate = resolveNaturalDate(
        parsed.dateTime ?? query,
        userTimeZone,
      );
      if (deterministicResolvedDate) {
        parsed.resolvedDate = deterministicResolvedDate;
      }

      this.logger.debug(`Parsed query: ${JSON.stringify(parsed)}`);
      return parsed;
    } catch (error) {
      this.logger.error(`Error parsing query: ${error.message}`, error.stack);
      // Fallback: treat the whole query as service intent
      return {
        serviceIntent: query.toLowerCase(),
        location: null,
        dateTime: null,
        resolvedDate: null,
        timeRange: null,
      };
    }
  }
}
