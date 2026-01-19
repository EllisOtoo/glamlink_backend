import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import probe from 'probe-image-size';
import { Readable } from 'stream';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET!;
const BATCH_SIZE = 10;

async function getImageDimensions(
  key: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3.send(command);
    if (!response.Body) {
      return null;
    }

    const bodyStream = response.Body as Readable;
    const result = await probe(bodyStream);

    return {
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.warn(
      `Failed to get dimensions for ${key}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function backfillImageDimensions() {
  console.log('Starting backfill of image dimensions...');

  // Find all service images without dimensions
  const imagesWithoutDimensions = await prisma.serviceImage.findMany({
    where: {
      OR: [{ width: null }, { height: null }],
    },
    select: {
      id: true,
      storageKey: true,
    },
  });

  console.log(
    `Found ${imagesWithoutDimensions.length} images without dimensions.`,
  );

  let updatedCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let i = 0; i < imagesWithoutDimensions.length; i += BATCH_SIZE) {
    const batch = imagesWithoutDimensions.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (image) => {
        const dimensions = await getImageDimensions(image.storageKey);

        if (dimensions) {
          await prisma.serviceImage.update({
            where: { id: image.id },
            data: {
              width: dimensions.width,
              height: dimensions.height,
            },
          });
          updatedCount++;
          console.log(
            `✓ Updated ${image.id}: ${dimensions.width}x${dimensions.height}`,
          );
        } else {
          failedCount++;
          console.log(`✗ Failed to get dimensions for ${image.id}`);
        }
      }),
    );

    // Progress
    const processed = Math.min(i + BATCH_SIZE, imagesWithoutDimensions.length);
    console.log(
      `Progress: ${processed}/${imagesWithoutDimensions.length} (${Math.round((processed / imagesWithoutDimensions.length) * 100)}%)`,
    );
  }

  console.log('\nBackfill complete!');
  console.log(`Updated: ${updatedCount}`);
  console.log(`Failed: ${failedCount}`);
}

backfillImageDimensions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
