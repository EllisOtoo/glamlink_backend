import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    {
      provide: S3Client,
      useFactory: (configService: ConfigService) => {
        const region = configService.getOrThrow<string>('S3_REGION');
        return new S3Client({ region });
      },
      inject: [ConfigService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
