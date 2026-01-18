import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * USAGE:
 * 1. Generate images using AI or gather local files.
 * 2. Update the 'uploads' array below with serviceId, vendorId, and local filePath.
 * 3. Run with: npx ts-node upload_generated_images.ts
 */

const uploads: Array<{ serviceId: string; vendorId: string; filePath: string; caption?: string }> = [
  // Example entry:
  // {
  //   serviceId: 'cmkiej...',
  //   vendorId: 'cmjykg...',
  //   filePath: './images/my-image.png',
  //   caption: 'Professional styling'
  // },
];

const prisma = new PrismaClient();

// Simple .env parser to avoid extra dependencies for the script
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  });
}

const s3 = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const bucketName = process.env.S3_BUCKET;

async function main() {
  if (uploads.length === 0) {
    console.log('No uploads defined in the "uploads" array.');
    return;
  }

  for (const upload of uploads) {
    if (!fs.existsSync(upload.filePath)) {
      console.warn(`File not found: ${upload.filePath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(upload.filePath);
    const extension = upload.filePath.split('.').pop() || 'png';
    const fileName = `${randomUUID()}.${extension}`;
    const storageKey = `vendors/${upload.vendorId}/services/${upload.serviceId}/${fileName}`;

    console.log(`Uploading ${upload.filePath} to ${storageKey}...`);

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: storageKey,
        Body: fileBuffer,
        ContentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        Metadata: {
          vendorId: upload.vendorId,
          serviceId: upload.serviceId,
          purpose: 'service_image',
        },
      })
    );

    console.log(`Updating database for service ${upload.serviceId}...`);

    await prisma.serviceImage.create({
      data: {
        serviceId: upload.serviceId,
        storageKey: storageKey,
        caption: upload.caption || 'Professional result',
        sortOrder: 0,
        width: 1024,  // Default for generated images
        height: 1024,
      },
    });
  }

  console.log('All uploads completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
