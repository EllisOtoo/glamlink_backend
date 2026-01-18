# Automation Scripts

These scripts help in identifying services missing images and automatically uploading AI-generated or local images to S3 and the database.

## 1. Finding Services Missing Images
Run this script to get a JSON list of services that currently have no images.

```bash
npx ts-node find_missing_images.ts
```

## 2. Uploading Generated Images
Use this script to bulk upload images.

### Steps:
1. **Gather Images**: Place your images in a local folder or note their absolute paths.
2. **Edit Script**: Open `upload_generated_images.ts` and populate the `uploads` array with the `serviceId`, `vendorId`, and `filePath`.
3. **Run Upload**:
   ```bash
   npx ts-node upload_generated_images.ts
   ```

### Note on Dimensions:
The script currently defaults to `1024x1024` for `width` and `height`, which is the standard for generated images. If using different sizes, update the `prisma.serviceImage.create` call in the script.
