import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private ai: GoogleGenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async generateEmbedding(
    text: string,
    imageBase64?: string,
    imageMimeType?: string,
  ): Promise<number[]> {
    try {
      const parts: Array<any> = [];
      if (text && text.trim().length > 0) {
        parts.push({ text });
      }

      if (imageBase64 && imageMimeType) {
        parts.push({
          inlineData: {
            data: imageBase64,
            mimeType: imageMimeType,
          },
        });
      }

      if (parts.length === 0) {
        throw new Error('Must provide either text or an image to generate an embedding.');
      }

      const response = await this.ai.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: { parts } as any, 
        config: {
          outputDimensionality: 1536,
        },
      });

      if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error('No embeddings returned by the model');
      }

      return response.embeddings[0].values as number[];
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Format array to a Postgres vector string representation: '[0.1, 0.2, ...]'
  formatVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
