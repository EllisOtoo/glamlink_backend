import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { EmbeddingService } from './src/ai-search/embedding.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const embeddingService = app.get(EmbeddingService);

  console.log('Fetching services without embeddings...');
  
  // Use raw SQL because Prisma Client ignores Unsupported("vector") column types
  const rawServices: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, name, description, includes FROM "Service" WHERE "searchEmbedding" IS NULL AND "isActive" = true;`
  );

  console.log(`Found ${rawServices.length} services without embeddings.`);

  for (const service of rawServices) {
    console.log(`Generating embedding for service: ${service.name}`);
    try {
      const includes = service.includes || [];
      const intentText = `${service.name} ${service.description || ''} ${includes.join(' ')}`.trim();
      const embedding = await embeddingService.generateEmbedding(intentText);
      const vectorString = embeddingService.formatVector(embedding);
      await prisma.$executeRawUnsafe(
        `UPDATE "Service" SET "searchEmbedding" = '${vectorString}'::vector WHERE id = '${service.id}'`
      );
      console.log(`Successfully updated embedding for ${service.name}`);
    } catch (error) {
      console.error(`Failed to update service ${service.id}:`, error.message);
    }
  }

  await app.close();
}

bootstrap();
