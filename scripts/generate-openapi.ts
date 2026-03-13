import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule);
  
  const config = new DocumentBuilder()
    .setTitle('Glamlink API')
    .setDescription('The Glamlink API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  const yamlString = yaml.stringify(document);
  
  const outputPath = path.join(__dirname, '..', 'openapi-spec.yaml');
  fs.writeFileSync(outputPath, yamlString);
  
  console.log(`OpenAPI spec generated at: ${outputPath}`);
  await app.close();
  process.exit(0);
}

generateOpenApi().catch((err) => {
  console.error('Error generating OpenAPI spec:', err);
  process.exit(1);
});
