import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_UPLOAD_EXPIRATION_SECONDS = 60 * 5;
const DEFAULT_DOWNLOAD_EXPIRATION_SECONDS = 60 * 10;

export interface PresignedUploadResult {
  storageKey: string;
  uploadUrl: string;
  expiresIn: number;
  headers: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly bucketName: string;
  private readonly region: string;
  private readonly cdnUrl: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Client,
  ) {
    this.bucketName = this.config.getOrThrow<string>('S3_BUCKET');
    this.region = this.config.getOrThrow<string>('S3_REGION');
    this.cdnUrl = this.config.get<string>('ASSETS_CDN_URL') ?? null;
  }

  async createPresignedUpload(params: {
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
    expiresIn?: number;
  }): Promise<PresignedUploadResult> {
    const expiresIn = params.expiresIn ?? DEFAULT_UPLOAD_EXPIRATION_SECONDS;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      ContentType: params.contentType,
      Metadata: params.metadata,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    return {
      storageKey: params.key,
      uploadUrl,
      expiresIn,
      headers: {
        'Content-Type': params.contentType,
      },
    };
  }

  async createPresignedDownload(params: {
    key: string;
    expiresIn?: number;
  }): Promise<string> {
    const expiresIn = params.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRATION_SECONDS;
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  buildPublicUrl(key: string, version?: number | null): string {
    const trimmedKey = key.replace(/^\/+/, '');
    const versionSuffix =
      typeof version === 'number' && version > 0 ? `?v=${version}` : '';

    if (this.cdnUrl) {
      const base = this.cdnUrl.replace(/\/+$/, '');
      return `${base}/${trimmedKey}${versionSuffix}`;
    }

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${trimmedKey}${versionSuffix}`;
  }

  async deleteObject(key: string): Promise<void> {
    if (!key) {
      return;
    }

    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
  }
}
