import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmbeddingService } from '../src/ai-search/embedding.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('BackfillEmbeddings');
  
  // We only need basic application context to use the services
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const embeddingService = app.get(EmbeddingService);
  
  logger.log('Starting service embeddings backfill...');
  
  // Find active services and join their vendor data
  const services = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      s.id, s.name, s.description, 
      v."businessName", v."locationArea"
    FROM "Service" s
    JOIN "Vendor" v ON s."vendorId" = v.id
    WHERE s."isActive" = true
  `);
  
  logger.log(`Found ${services.length} active services. Regenerating embeddings...`);
  
  for (const svc of services) {
    try {
      // Create rich context string that includes vendor identity and location
      const locationContext = svc.locationArea ? ` located in ${svc.locationArea}` : '';
      const intentText = `${svc.name} provided by ${svc.businessName}${locationContext}. Description: ${svc.description || 'N/A'}`;
      
      logger.log(`Generating embedding for service ${svc.id}: ${intentText.substring(0, 50)}...`);
      
      const embedding = await embeddingService.generateEmbedding(intentText);
      const vectorString = embeddingService.formatVector(embedding);
      
      // Update DB with vector
      await prisma.$executeRawUnsafe(
        `UPDATE "Service" SET "searchEmbedding" = '${vectorString}'::vector WHERE id = '${svc.id}';`
      );
      
      logger.log(`Successfully updated service ${svc.id}`);
      
      // Artificial delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
       logger.error(`Failed to process service ${svc.id}`, error.stack);
    }
  }
  
  logger.log('Backfill completed.');
  await app.close();
  process.exit(0);
}

bootstrap();
